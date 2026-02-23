import { env } from '../config/env';

type WechatTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserInfoResponse = {
  openid?: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
  errmsg?: string;
};

export type WechatExchangeResult = {
  openId: string;
  unionId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
};

export async function exchangeWechatCode(code: string): Promise<WechatExchangeResult> {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new Error('AUTH_WECHAT_NOT_CONFIGURED');
  }

  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  tokenUrl.searchParams.set('appid', env.WECHAT_APP_ID);
  tokenUrl.searchParams.set('secret', env.WECHAT_APP_SECRET);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('grant_type', 'authorization_code');

  const tokenResp = await fetch(tokenUrl);
  if (!tokenResp.ok) {
    throw new Error(`AUTH_WECHAT_HTTP_${tokenResp.status}`);
  }
  const tokenData = (await tokenResp.json()) as WechatTokenResponse;
  if (tokenData.errcode || !tokenData.openid || !tokenData.access_token) {
    throw new Error(`AUTH_WECHAT_EXCHANGE_FAILED:${tokenData.errcode || 'unknown'}`);
  }

  const userInfoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
  userInfoUrl.searchParams.set('access_token', tokenData.access_token);
  userInfoUrl.searchParams.set('openid', tokenData.openid);
  userInfoUrl.searchParams.set('lang', 'zh_CN');

  let nickname: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const userResp = await fetch(userInfoUrl);
    if (userResp.ok) {
      const userData = (await userResp.json()) as WechatUserInfoResponse;
      if (!userData.errcode) {
        nickname = userData.nickname || null;
        avatarUrl = userData.headimgurl || null;
      }
    }
  } catch {
    // keep exchange successful even when optional userinfo fails
  }

  return {
    openId: tokenData.openid,
    unionId: tokenData.unionid || null,
    nickname,
    avatarUrl,
  };
}
