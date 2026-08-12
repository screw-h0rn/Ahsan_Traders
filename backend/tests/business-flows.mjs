/**
 * End-to-end business flow tests (`pnpm test:flows`).
 *
 * Rebuilds the local database from migrations, then drives the real business
 * through it as real people: an owner, a sales rep, a warehouse hand, and a
 * shop using the mobile app. Every assertion is about behaviour a user would
 * notice, not about the shape of the schema.
 *
 * Requires Docker. Nothing here touches a live Supabase project.
 */
import { rebuild, psql, stop } from './local-db.mjs';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// psql echoes a status tag for every statement (BEGIN, SET, COMMIT…), and
// set_config echoes the value it set. Strip all of that so the helpers return
// only the rows the final query produced.
const NOISE = new Set(['BEGIN', 'COMMIT', 'ROLLBACK', 'SET', 'RESET']);
const clean = (out, extra = []) =>
  out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !NOISE.has(l) && !extra.includes(l));

/** Run SQL as a specific auth user, with RLS applied. */
function as(userId, sql) {
  const wrapped = `
    set local role authenticated;
    select set_config('request.jwt.claim.sub', ${userId ? `'${userId}'` : "''"}, true);
    ${sql}
  `;
  return clean(psql(`begin; ${wrapped} ; commit;`, ['-At', '-F', '|']), [userId ?? '']);
}

/** Run SQL as the database owner, bypassing RLS. For setup and assertions. */
function admin(sql) {
  return clean(psql(sql, ['-At', '-F', '|']));
}

/** Expect a statement to be rejected; returns the error text. */
function expectDenied(userId, sql) {
  try {
    as(userId, sql);
    return null;
  } catch (error) {
    return ((error.stdout ?? '') + (error.stderr ?? '')).trim();
  }
}

const one = (rows) => (rows.length ? rows[rows.length - 1] : '');
const num = (rows) => Number(one(rows));

console.log('Rebuilding local database from migrations…\n');
await rebuild();
console.log('\nRunning business flows…\n');

try {
  // ---------------------------------------------------------------- people --
  admin(`
    insert into auth.users (id, email, raw_user_meta_data)
      values ('11111111-1111-1111-1111-111111111111', 'owner@ahsan.pk', '{"full_name":"Ahsan Owner"}');
    insert into auth.users (id, email, raw_user_meta_data)
      values ('22222222-2222-2222-2222-222222222222', 'rep@ahsan.pk',
              '{"full_name":"Sales Rep","staff_invite":"true","role":"sales"}');
    insert into auth.users (id, email, raw_user_meta_data)
      values ('33333333-3333-3333-3333-333333333333', 'store@ahsan.pk',
              '{"full_name":"Warehouse","staff_invite":"true","role":"warehouse"}');
  `);
  const OWNER = '11111111-1111-1111-1111-111111111111';
  const REP = '22222222-2222-2222-2222-222222222222';
  const STORE = '33333333-3333-3333-3333-333333333333';

  check('first signup becomes the owner',
    one(admin(`select role from public.staff where id = '${OWNER}';`)) === 'owner');
  check('invited rep gets the sales role',
    one(admin(`select role from public.staff where id = '${REP}';`)) === 'sales');

  // ------------------------------------------------------------ setup data --
  admin(`
    update public.company_settings set name = 'Ahsan Traders', tax_rate = 17 where id;
    insert into public.categories (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Beverages');
    insert into public.products (id, category_id, name, sku, unit, units_per_carton, sale_price, carton_sale_price)
      values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
              'Cola 500ml','COLA-500','bottle',12,50,550);
    insert into public.suppliers (id, name) values ('cccccccc-0000-0000-0000-000000000001','Metro Supply');
    insert into public.customers (id, name, phone, credit_limit)
      values ('dddddddd-0000-0000-0000-000000000001','Madina Store','0300-1234567', 10000);
    insert into public.customers (id, name, phone, credit_limit)
      values ('dddddddd-0000-0000-0000-000000000002','Cash Only Shop','0311-2223333', 0);
  `);
  const PRODUCT = 'bbbbbbbb-0000-0000-0000-000000000001';
  const SUPPLIER = 'cccccccc-0000-0000-0000-000000000001';
  const MADINA = 'dddddddd-0000-0000-0000-000000000001';
  const CASHONLY = 'dddddddd-0000-0000-0000-000000000002';
  const BRANCH = one(admin(`select id from public.branches limit 1;`));

  // ------------------------------------------------------------ purchasing --
  const po = as(OWNER, `
    select purchase_order_id from public.create_purchase_order(
      '${SUPPLIER}', '${BRANCH}', null, 'first order',
      '[{"product_id":"${PRODUCT}","uom":"carton","qty_entered":10,"unit_price":480}]'::jsonb);
  `);
  const PO = one(po);
  as(OWNER, `select public.issue_purchase_order('${PO}');`);

  const poItem = one(admin(`select id from public.purchase_order_items where purchase_order_id='${PO}';`));
  as(STORE, `
    select public.receive_purchase_order('${PO}', current_date, 'received in full',
      '[{"purchase_order_item_id":"${poItem}","quantity_received":120}]'::jsonb);
  `);

  check('10 cartons of 12 receive as 120 bottles',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 120);
  check('average cost is per bottle, not per carton',
    num(admin(`select avg_cost from public.products where id='${PRODUCT}';`)) === 40);
  check('supplier is owed the purchase value',
    num(as(OWNER, `select public.supplier_balance('${SUPPLIER}');`)) === 4800);

  // ----------------------------------------------------------- selling ------
  const order = as(REP, `
    select sales_order_id, order_status from public.create_sales_order(
      '${MADINA}', '${BRANCH}', 'counter sale',
      '[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":20,"unit_price":50}]'::jsonb);
  `);
  const [SO, soStatus] = one(order).split('|');

  check('a valid order is PENDING, not confirmed', soStatus === 'pending', soStatus);
  check('creating an order does NOT move stock',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 120);

  const invoice = as(REP, `
    select total from public.create_sales_invoice('${SO}', current_date, null);
  `);
  check('invoice applies 17% tax (1000 -> 1170)', num(invoice) === 1170, one(invoice));
  check('invoicing deducts stock exactly once (120 - 20 = 100)',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 100);
  check('order becomes CONFIRMED after invoicing',
    one(admin(`select status from public.sales_orders where id='${SO}';`)) === 'confirmed');
  check('on-hand equals the sum of stock movements',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`))
    === num(admin(`select sum(quantity_delta) from public.stock_movements where product_id='${PRODUCT}';`)));
  check('customer now owes the invoice total',
    num(as(OWNER, `select public.customer_balance('${MADINA}');`)) === 1170);

  const reinvoice = expectDenied(REP, `select public.create_sales_invoice('${SO}', current_date, null);`);
  check('the same order cannot be invoiced twice', Boolean(reinvoice));

  // ------------------------------------------------------------- credit -----
  const overLimit = as(REP, `
    select order_status, hold_reason from public.create_sales_order(
      '${MADINA}', '${BRANCH}', 'too big',
      '[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":30,"unit_price":500}]'::jsonb);
  `);
  check('an order over the credit limit is HELD',
    one(overLimit).startsWith('held') && /Credit limit/i.test(one(overLimit)), one(overLimit));

  const cashOnly = as(REP, `
    select order_status, hold_reason from public.create_sales_order(
      '${CASHONLY}', '${BRANCH}', 'cash customer',
      '[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":1,"unit_price":50}]'::jsonb);
  `);
  check('credit limit 0 means cash only, so any credit order is held',
    /Credit limit/i.test(one(cashOnly)), one(cashOnly));

  // ------------------------------------------------------------ payment -----
  as(OWNER, `
    select public.record_payment('customer','${MADINA}','in', 1170, 'cash', current_date, 'paid in full', null, null);
  `);
  check('payment clears the customer balance',
    num(as(OWNER, `select public.customer_balance('${MADINA}');`)) === 0);
  check('payment auto-allocates and marks the invoice paid',
    one(admin(`select payment_status from public.sales_invoices where sales_order_id='${SO}';`)) === 'paid');

  // ------------------------------------------------- customer app (a shop) --
  admin(`
    insert into auth.users (id, phone, raw_user_meta_data)
      values ('44444444-4444-4444-4444-444444444444', '+92 300 1234567', '{"account_type":"customer"}');
    insert into auth.users (id, phone, raw_user_meta_data)
      values ('55555555-5555-5555-5555-555555555555', '+92 399 0000000', '{"account_type":"customer"}');
  `);
  const SHOP = '44444444-4444-4444-4444-444444444444';
  const STRANGER = '55555555-5555-5555-5555-555555555555';

  check('a shop signing up by phone is linked to its customer record',
    one(admin(`select status from public.customer_accounts where id='${SHOP}';`)) === 'active');
  check('an unrecognised number stays pending and unlinked',
    one(admin(`select status from public.customer_accounts where id='${STRANGER}';`)) === 'pending');

  // ---- a brand-new shopkeeper's signup carries what they typed -----------
  admin(`
    insert into auth.users (id, phone, raw_user_meta_data) values (
      '66666666-6666-6666-6666-666666666666', '+92 333 5551234',
      '{"account_type":"customer","shop_name":"New Corner Store","city":"Landhi"}'
    );
  `);
  const NEWSHOP = '66666666-6666-6666-6666-666666666666';
  check('a new shopkeeper signup carries their claimed shop name and city',
    one(admin(`select requested_shop_name || '|' || requested_city
               from public.customer_accounts where id='${NEWSHOP}';`)) === 'New Corner Store|Landhi');

  // ---- owner reviews it and creates + approves in one step ----------------
  const approved = as(OWNER, `
    select customer_id from public.approve_customer_signup('${NEWSHOP}', null, null, null, 15000);
  `);
  const NEW_CUSTOMER_ID = one(approved);
  check('approve_customer_signup creates a customer from the signup details',
    one(admin(`select name from public.customers where id='${NEW_CUSTOMER_ID}';`)) === 'New Corner Store');
  check('the created customer gets the credit limit the owner set',
    num(admin(`select credit_limit from public.customers where id='${NEW_CUSTOMER_ID}';`)) === 15000);
  check('the signup is now active and linked',
    one(admin(`select status from public.customer_accounts where id='${NEWSHOP}';`)) === 'active');

  const newShopMe = as(NEWSHOP, `select name, credit_limit from public.customer_me();`);
  check('the approved shopkeeper can now log in and see their account',
    one(newShopMe) === 'New Corner Store|15000.00', one(newShopMe));

  const repApprove = expectDenied(REP, `select public.approve_customer_signup('${NEWSHOP}', null, null, null, null);`);
  check('a sales rep cannot approve customer signups', Boolean(repApprove));

  const me = as(SHOP, `select name, balance, credit_limit from public.customer_me();`);
  check('the shop sees its own account', one(me).startsWith('Madina Store'), one(me));

  const strangerBlocked = expectDenied(STRANGER, `select * from public.customer_me();`);
  check('a pending signup can see nothing', Boolean(strangerBlocked));

  const catalog = as(SHOP, `select name, unit_price, carton_price, in_stock from public.customer_catalog();`);
  check('the shop can browse the catalogue', one(catalog).startsWith('Cola 500ml'), one(catalog));
  check('catalogue shows the carton price', one(catalog).includes('550'), one(catalog));

  // RLS hides the rows rather than raising, which is the better behaviour: the
  // shop cannot even tell the products table exists, let alone read its costs.
  const productRows = as(SHOP, `select count(*) from public.products;`);
  const costSum = as(SHOP, `select coalesce(sum(purchase_price)::text, 'none') from public.products;`);
  check('a shop can read no rows at all from the products table',
    num(productRows) === 0, one(productRows));
  check('a shop cannot read cost prices', one(costSum) === 'none', one(costSum));

  const otherLeak = as(SHOP, `select count(*) from public.customers;`);
  check('a shop sees only its own customer row', num(otherLeak) === 1, one(otherLeak));

  const appOrder = as(SHOP, `
    select sales_order_id, order_status, total from public.customer_place_order(
      '[{"product_id":"${PRODUCT}","uom":"carton","qty_entered":2}]'::jsonb, 'please deliver tomorrow');
  `);
  const [APP_SO, appStatus, appTotal] = one(appOrder).split('|');
  check('a shop order lands as AWAITING APPROVAL', appStatus === 'awaiting_approval', appStatus);
  check('the price comes from the catalogue, not the app (2 x 550)', Number(appTotal) === 1100, appTotal);
  check('a shop order does not move stock',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 100);
  check('staff are notified about the app order',
    num(admin(`select count(*) from public.notifications where reference_id='${APP_SO}';`)) >= 1);

  // A shop must not be able to invent its own price.
  const priceOverride = as(SHOP, `
    select total from public.customer_place_order(
      '[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":1,"unit_price":1}]'::jsonb, null);
  `);
  check('a shop cannot override the price', num(priceOverride) === 50, one(priceOverride));

  as(OWNER, `select public.approve_sales_order('${APP_SO}');`);
  check('approving a shop order makes it PENDING',
    one(admin(`select status from public.sales_orders where id='${APP_SO}';`)) === 'pending');
  check('approval still does not move stock',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 100);

  as(OWNER, `select public.create_sales_invoice('${APP_SO}', current_date, null);`);
  check('invoicing the shop order deducts 24 bottles (100 - 24 = 76)',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 76);

  const myOrders = as(SHOP, `select count(*) from public.customer_my_orders();`);
  check('the shop sees its own order history', num(myOrders) >= 2, one(myOrders));

  const statement = as(SHOP, `select count(*) from public.customer_my_statement();`);
  check('the shop can pull its own statement', num(statement) >= 1, one(statement));

  const orderDetail = as(SHOP, `
    select so_number, product_name, line_total from public.customer_order_detail('${APP_SO}');
  `);
  check('the shop can see the lines of its own order',
    one(orderDetail).includes('SO-APP') && one(orderDetail).length > 0, one(orderDetail));

  const strangerOrderDetail = expectDenied(STRANGER, `
    select * from public.customer_order_detail('${APP_SO}');
  `);
  check("a stranger cannot read another shop's order detail", Boolean(strangerOrderDetail));

  const myInvoices = as(SHOP, `select count(*) from public.customer_my_invoices();`);
  check('the shop sees its own invoices', num(myInvoices) >= 1, one(myInvoices));

  as(SHOP, `select public.register_push_token('ExponentPushToken[test]', 'android');`);
  check('register_push_token actually stores the device row',
    num(admin(`select count(*) from public.device_push_tokens where user_id='${SHOP}';`)) === 1);

  const notifCountBefore = num(admin(
    `select count(*) from public.notifications where recipient_id='${OWNER}' and read_at is null;`));
  const markedCount = num(as(OWNER, `select public.mark_notifications_read();`));
  check('mark_notifications_read reports at least the notifications it marked',
    notifCountBefore >= 1 && markedCount === notifCountBefore,
    `before=${notifCountBefore} marked=${markedCount}`);
  const notifCountAfter = num(admin(
    `select count(*) from public.notifications where recipient_id='${OWNER}' and read_at is null;`));
  check('marked notifications are no longer unread', notifCountAfter === 0, String(notifCountAfter));

  // ---- staff link/block a customer login end to end -----------------------
  const linkResult = as(OWNER, `
    select public.link_customer_account('${STRANGER}', '${CASHONLY}');
    select ca.status from public.customer_accounts ca where ca.id='${STRANGER}';
  `);
  check('owner can link a pending signup to a customer',
    one(linkResult) === 'active', one(linkResult));

  const blockResult = as(OWNER, `
    select public.block_customer_account('${STRANGER}');
    select ca.status from public.customer_accounts ca where ca.id='${STRANGER}';
  `);
  check('owner can block a customer login', one(blockResult) === 'blocked', one(blockResult));

  const blockedAccess = expectDenied(STRANGER, `select * from public.customer_me();`);
  check('a blocked login is denied access', Boolean(blockedAccess));

  // ---- field_app_bootstrap returns real, correctly-shaped data -------------
  const bootstrap = as(OWNER, `select public.field_app_bootstrap();`);
  const bootstrapJson = JSON.parse(one(bootstrap));
  check('field_app_bootstrap returns the company profile',
    typeof bootstrapJson.company === 'object' && typeof bootstrapJson.company.name === 'string');
  check('field_app_bootstrap returns a product list with stock quantities',
    Array.isArray(bootstrapJson.products) && bootstrapJson.products.length >= 1
      && typeof bootstrapJson.products[0].quantity === 'number');
  check('field_app_bootstrap returns customers with computed balances',
    Array.isArray(bootstrapJson.customers) && bootstrapJson.customers.some((c) => c.id === MADINA));

  // ---- sync_mobile_action: CAPTURE_PAYMENT (the other half of the field app) --
  const balanceBefore = num(as(OWNER, `select public.customer_balance('${MADINA}');`));
  const capture = as(OWNER, `
    select public.sync_mobile_action('device-b','local-pay-1','CAPTURE_PAYMENT',
      '{"party_id":"${MADINA}","amount":500,"method":"cash"}'::jsonb);
  `);
  check('the field app can capture a payment',
    one(capture).includes('"synced"') || one(capture).includes('synced'), one(capture));
  const balanceAfter = num(as(OWNER, `select public.customer_balance('${MADINA}');`));
  check('captured payment reduces the customer balance by exactly the amount',
    Math.round((balanceBefore - balanceAfter) * 100) === 50000, `${balanceBefore} -> ${balanceAfter}`);

  const captureReplay = as(OWNER, `
    select public.sync_mobile_action('device-b','local-pay-1','CAPTURE_PAYMENT',
      '{"party_id":"${MADINA}","amount":500,"method":"cash"}'::jsonb);
  `);
  check('replaying the same payment action does not double-charge',
    one(captureReplay).includes('replayed'), one(captureReplay));
  const balanceAfterReplay = num(as(OWNER, `select public.customer_balance('${MADINA}');`));
  check('balance unchanged after replay', balanceAfterReplay === balanceAfter);

  // --------------------------------------------------------- role limits ---
  const repStock = expectDenied(REP, `
    select public.adjust_stock('${PRODUCT}', '${BRANCH}', 5, null, 'adjustment', null, null, null);
  `);
  check('a sales rep cannot change stock', Boolean(repStock));

  const repPayment = expectDenied(REP, `
    select public.record_payment('customer','${MADINA}','in',100,'cash',current_date,null,null,null);
  `);
  check('a sales rep cannot record payments', Boolean(repPayment));

  const storeSupplierCost = as(STORE, `select count(*) from public.suppliers;`);
  check('warehouse staff can see suppliers for receiving', num(storeSupplierCost) === 1);

  const repSuppliers = as(REP, `select count(*) from public.suppliers;`);
  check('a sales rep cannot see suppliers', num(repSuppliers) === 0, one(repSuppliers));

  const shopLedger = as(SHOP, `select count(*) from public.ledger_entries;`);
  const totalLedger = num(admin(`select count(*) from public.ledger_entries;`));
  check('a shop sees only its own ledger rows',
    num(shopLedger) > 0 && num(shopLedger) < totalLedger, `${one(shopLedger)} of ${totalLedger}`);

  // ------------------------------------------------------------- field app --
  const sync = as(REP, `
    select public.sync_mobile_action('device-a','local-1','BOOK_ORDER',
      '{"customer_id":"${MADINA}","branch_id":"${BRANCH}","items":[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":2}]}'::jsonb);
  `);
  check('the field app can book an order', one(sync).includes('"status" : "synced"') || one(sync).includes('"status": "synced"'), one(sync));
  check('a booked order does not move stock',
    num(admin(`select quantity from public.inventory where product_id='${PRODUCT}';`)) === 76);

  const replay = as(REP, `
    select public.sync_mobile_action('device-a','local-1','BOOK_ORDER',
      '{"customer_id":"${MADINA}","branch_id":"${BRANCH}","items":[{"product_id":"${PRODUCT}","uom":"unit","qty_entered":2}]}'::jsonb);
  `);
  check('replaying the same action does not duplicate the order', one(replay).includes('replayed'));
  check('only one order exists for that device action',
    num(admin(`select count(*) from public.mobile_sync_queue where device_id='device-a';`)) === 1);

  // -------------------------------------------------------------- audit ----
  check('every write is audited',
    num(admin(`select count(*) from public.audit_logs;`)) > 20);

  let auditImmutable = null;
  try {
    admin(`delete from public.audit_logs where true;`);
  } catch (error) {
    auditImmutable = String(error.stderr ?? error.stdout ?? '');
  }
  check('audit logs cannot be deleted, even by the database owner', Boolean(auditImmutable));

  // Deleting a customer must not be blocked by the audit trail.
  let deletable = true;
  try {
    admin(`
      insert into public.customers (id, name) values ('eeeeeeee-0000-0000-0000-000000000009','Temp');
      delete from public.customers where id='eeeeeeee-0000-0000-0000-000000000009';
    `);
  } catch {
    deletable = false;
  }
  check('records can still be deleted (audit FKs do not deadlock)', deletable);

  // ------------------------------------------------------------ dashboard --
  const dash = as(OWNER, `select public.dashboard_summary();`);
  check('the dashboard returns in one call', one(dash).includes('receivables'), one(dash).slice(0, 80));

  // ------------------------------------- NULL-role bypass regression -------
  // A caller with no staff row (current_staff_role() = NULL) must be denied
  // by every one of these, not silently let through by `NULL not in (...)`
  // evaluating to NULL — which plpgsql's `if` treats as false. This exact bug
  // let any signed-in customer read report_party_balances('customer') and
  // call adjust_stock() on 10 Aug 2026; caught only by hand-testing the
  // portal, not by this suite, which is why it is pinned here permanently.
  const NOBODY = '99999999-9999-9999-9999-999999999999';
  const nullRoleChecks = [
    ['adjust_stock', `select public.adjust_stock('${PRODUCT}','${BRANCH}', 1, null, 'adjustment', null, null, null);`],
    ['report_party_balances', `select * from public.report_party_balances('customer');`],
    ['report_sales_summary', `select * from public.report_sales_summary();`],
    ['report_inventory_status', `select * from public.report_inventory_status();`],
    ['report_profit', `select * from public.report_profit();`],
    ['report_party_statement', `select * from public.report_party_statement('customer','${MADINA}');`],
    ['open_documents', `select * from public.open_documents('customer','${MADINA}');`],
    ['dashboard_summary', `select public.dashboard_summary();`],
    ['field_app_bootstrap', `select public.field_app_bootstrap();`],
  ];
  for (const [name, sql] of nullRoleChecks) {
    const denied = expectDenied(NOBODY, sql);
    check(`${name} denies a caller with no staff role`, Boolean(denied), denied ?? '(ran without error)');
  }
} catch (error) {
  failed += 1;
  console.error(`  FAIL  harness — ${((error.stdout ?? '') + (error.stderr ?? '') + error.message).slice(0, 800)}`);
} finally {
  if (!process.argv.includes('--keep')) stop();
}

console.log(`\nBusiness flows: ${passed} passed, ${failed} failed.`);
if (failures.length) console.log(`Failed: ${failures.join(', ')}`);
process.exit(failed === 0 ? 0 : 1);
