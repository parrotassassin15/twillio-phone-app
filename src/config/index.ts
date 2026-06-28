export const Config = {
  BASE_URL: 'https://lorikeetsecurity.com',

  APP_VERSION_CODE: 3,
  APP_VERSION_NAME: '1.1',
  UPDATE_CHECK_URL: 'http://192.168.1.137:9001/version.json',

  CALLER_IDS: [
    { label: 'Toll-Free',  number: '+18886526479' },
    { label: 'Kissimmee', number: '+16892023940' },
    { label: 'New York',   number: '+19295773213' },
  ],

  EXTENSIONS: [
    { ext: '100', name: 'Toll-Free Main', number: '+18886526479' },
    { ext: '101', name: 'Kissimmee HQ',   number: '+16892023940' },
    { ext: '102', name: 'NY Office',      number: '+19295773213' },
    { ext: '103', name: 'Ryan',           number: '+18034400583' },
  ],

  CONTACTS: {
    '+18886526479': 'Lorikeet Security',
    '+16892023940': 'Lorikeet Security (Kissimmee)',
    '+19295773213': 'Lorikeet Security (NY)',
    '+18034400583': 'Ryan',
  } as Record<string, string>,

  TOKEN_REFRESH_MS: 50 * 60 * 1000,
};

export type Extension = (typeof Config.EXTENSIONS)[number];
export type CallerId  = (typeof Config.CALLER_IDS)[number];
