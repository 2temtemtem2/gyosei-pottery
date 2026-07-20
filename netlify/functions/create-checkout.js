// 購入ボタンが押されたら、その商品の価格でStripe決済ページを動的に生成する。
// 価格はこのサーバー側を「正」とする（クライアントから送られた金額は信用しない＝改ざん防止）。
const Stripe = require('stripe');

// 商品マスタ（価格の正本）。新商品はここに1行足すだけ。
const PRODUCTS = {
  meshiwan:  { name: '粉引 飯碗',   amount: 3200 },
  yunomi:    { name: '灰釉 湯呑',   amount: 2400 },
  kozara:    { name: '刷毛目 小皿', amount: 1800 },
  mug:       { name: '青磁 マグ',   amount: 3600 },
  nakabachi: { name: '白磁 中鉢',   amount: 4200 },
  oozara:    { name: '青磁 七寸皿', amount: 4800 },
};

const SHIPPING_JPY = 770; // 全国一律送料（あとで調整可）

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Stripe未設定（キー未登録）。フロント側で「準備中」を表示させる。
    return { statusCode: 503, body: JSON.stringify({ error: 'not_configured' }) };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    const product = PRODUCTS[id];
    if (!product) {
      return { statusCode: 400, body: JSON.stringify({ error: 'unknown_product' }) };
    }

    const stripe = Stripe(key);
    const origin = event.headers.origin || ('https://' + event.headers.host);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: { name: product.name },
          unit_amount: product.amount,
        },
        quantity: 1,
      }],
      shipping_address_collection: { allowed_countries: ['JP'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: SHIPPING_JPY, currency: 'jpy' },
          display_name: '全国一律送料',
        },
      }],
      success_url: origin + '/thanks.html',
      cancel_url: origin + '/#works',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
