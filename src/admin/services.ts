// The external services that run the Commonwealth, as quick links on /admin (dev-only). Links and public identifiers
// only: no client id, secret, token or key ever goes here. A YouTube group is drawn per commission with a `channelId`.
import { commissions, site } from '../config/site';

type ServiceIcon = 'youtube' | 'key' | 'api' | 'cloud' | 'globe' | 'voice';
interface ServiceLink {
  label: string;
  url: string;
  d: string; // one line: what you go there for
  primary?: boolean; // a frequent one: list it first; emphasised
}
interface ServiceGroup {
  title: string;
  icon: ServiceIcon;
  ids: { label: string; value: string }[]; // public identifiers shown beside the links
  links: ServiceLink[];
}

const gcp = 'commonwealth-of-reason';
const cf = { account: '7dbe2a523b04cbea9f9bc6d7757ed8ae', worker: 'commonwealth-of-reason', env: 'production' };
const az = {
  tenant: 'jonborchardtgmail.onmicrosoft.com',
  subscription: '1c33aea5-b13a-40f3-8da2-aeed7824da4c',
  group: 'video-knowledge',
  account: 'speech-video-knowledge',
};
const yt = 'https://console.cloud.google.com/apis/api/youtube.googleapis.com';

const channel = (name: string, youtube: string, id: string): ServiceGroup => {
  const studio = `https://studio.youtube.com/channel/${id}`;
  return {
    title: `YouTube: ${name}`,
    icon: 'youtube',
    ids: [{ label: 'Channel ID', value: id }],
    links: [
      { primary: true, label: 'Public channel', url: youtube, d: 'what viewers see' },
      {
        primary: true,
        label: 'Videos and uploads',
        url: `${studio}/videos/upload?filter=%5B%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D`,
        d: 'every upload, newest first',
      },
      { label: 'Profile and branding', url: `${studio}/editing/profile`, d: 'name, handle, avatar, banner' },
      { label: 'YouTube Studio', url: 'https://studio.youtube.com/', d: 'the Studio home' },
      { label: 'Channel verification', url: 'https://www.youtube.com/verify', d: 'phone verification, long uploads' },
      { label: 'Advanced settings', url: 'https://www.youtube.com/account_advanced', d: 'channel id, account links' },
    ],
  };
};

export const serviceGroups: ServiceGroup[] = [
  ...Object.values(commissions).flatMap((c) =>
    c.channelId && c.youtube ? [channel(c.name, c.youtube, c.channelId)] : [],
  ),
  {
    title: 'Google Cloud: OAuth',
    icon: 'key',
    ids: [{ label: 'Project', value: gcp }],
    links: [
      {
        primary: true,
        label: 'OAuth clients',
        url: `https://console.cloud.google.com/auth/clients?project=${gcp}`,
        d: 'the Desktop client the uploader uses',
      },
      {
        label: 'Create OAuth client',
        url: `https://console.cloud.google.com/auth/clients/create?project=${gcp}`,
        d: 'a new client JSON',
      },
      {
        label: 'Branding',
        url: `https://console.cloud.google.com/auth/branding?project=${gcp}`,
        d: 'the consent screen',
      },
      {
        label: 'Audience and publishing status',
        url: `https://console.cloud.google.com/auth/audience?project=${gcp}`,
        d: 'test users, testing or production',
      },
      {
        label: 'Scopes and permissions',
        url: `https://console.cloud.google.com/auth/scopes?project=${gcp}`,
        d: 'what the consent asks for',
      },
      {
        label: 'Connected apps',
        url: 'https://myaccount.google.com/connections',
        d: 'revoke a grant from your Google account',
      },
    ],
  },
  {
    title: 'YouTube Data API',
    icon: 'api',
    ids: [{ label: 'Project', value: gcp }],
    links: [
      { primary: true, label: 'Metrics and usage', url: `${yt}/metrics?project=${gcp}`, d: 'calls and errors' },
      { label: 'Quotas', url: `${yt}/quotas?project=${gcp}`, d: 'units left today' },
      {
        label: 'API configuration',
        url: `https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=${gcp}`,
        d: 'enable or disable the API',
      },
      { label: 'Documentation', url: 'https://developers.google.com/youtube/v3', d: 'the v3 reference' },
      {
        label: 'videos.insert reference',
        url: 'https://developers.google.com/youtube/v3/docs/videos/insert',
        d: 'the upload call',
      },
      {
        label: 'Quota costs',
        url: 'https://developers.google.com/youtube/v3/determine_quota_cost',
        d: 'units per call',
      },
    ],
  },
  {
    title: 'Azure: Speech',
    icon: 'voice',
    ids: [
      { label: 'Resource', value: az.account },
      { label: 'Resource group', value: az.group },
    ],
    links: [
      {
        primary: true,
        label: 'Speech resource',
        url: `https://portal.azure.com/#@${az.tenant}/resource/subscriptions/${az.subscription}/resourceGroups/${az.group}/providers/Microsoft.CognitiveServices/accounts/${az.account}/eventlogs`,
        d: 'the release voice (video final): logs, usage',
      },
      { label: 'Azure portal', url: 'https://portal.azure.com/', d: 'billing, other resources' },
    ],
  },
  {
    title: 'Cloudflare: hosting',
    icon: 'cloud',
    ids: [
      { label: 'Worker', value: cf.worker },
      { label: 'Environment', value: cf.env },
    ],
    links: [
      {
        primary: true,
        label: 'Worker deployments',
        url: `https://dash.cloudflare.com/${cf.account}/workers/services/view/${cf.worker}/${cf.env}/deployments`,
        d: 'what is live, roll back',
      },
      { label: 'Dashboard', url: 'https://dash.cloudflare.com/', d: 'DNS, domains, analytics' },
    ],
  },
  {
    title: 'Production website',
    icon: 'globe',
    ids: [],
    links: [{ primary: true, label: site.name, url: site.url, d: 'the public site' }],
  },
];
