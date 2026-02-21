const MARKUP = 1.1

interface CategoryRates {
  marketing: number
  utility: number
  authentication: number
  service: number
}

const RATES_MICRODOLLARS: Record<string, CategoryRates> = {
  "1":   { marketing: 36100, utility: 25300, authentication: 18100, service: 0 },
  "52":  { marketing: 69600, utility: 13900, authentication: 6700,  service: 0 },
  "55":  { marketing: 95100, utility: 24400, authentication: 9500,  service: 0 },
  "91":  { marketing: 15600, utility: 5200,  authentication: 3600,  service: 0 },
  "44":  { marketing: 106300, utility: 52500, authentication: 40100, service: 0 },
  "49":  { marketing: 202600, utility: 94300, authentication: 94300, service: 0 },
  "33":  { marketing: 219300, utility: 81200, authentication: 81200, service: 0 },
  "34":  { marketing: 93000, utility: 42400, authentication: 42400, service: 0 },
  "39":  { marketing: 102300, utility: 42400, authentication: 42400, service: 0 },
  "81":  { marketing: 300600, utility: 136300, authentication: 136300, service: 0 },
  "86":  { marketing: 128000, utility: 58600, authentication: 58600, service: 0 },
  "62":  { marketing: 63700, utility: 31200, authentication: 31200, service: 0 },
  "234": { marketing: 78000, utility: 18600, authentication: 18600, service: 0 },
  "27":  { marketing: 46500, utility: 11100, authentication: 11100, service: 0 },
  "57":  { marketing: 15400, utility: 2800,  authentication: 2800,  service: 0 },
  "54":  { marketing: 90100, utility: 53800, authentication: 53800, service: 0 },
  "56":  { marketing: 70000, utility: 13200, authentication: 6700,  service: 0 },
}

const DEFAULT_RATES: CategoryRates = {
  marketing: 100000,
  utility: 40000,
  authentication: 40000,
  service: 0,
}

const COUNTRY_CODES = [
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39",
  "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52",
  "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64",
  "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94",
  "95", "98", "211", "212", "213", "216", "218", "220", "221", "222",
  "223", "224", "225", "226", "227", "228", "229", "230", "231", "232",
  "233", "234", "235", "236", "237", "238", "239", "240", "241", "242",
  "243", "244", "245", "246", "247", "248", "249", "250", "251", "252",
  "253", "254", "255", "256", "257", "258", "260", "261", "262", "263",
  "264", "265", "266", "267", "268", "269", "290", "291", "297", "298",
  "299", "350", "351", "352", "353", "354", "355", "356", "357", "358",
  "359", "370", "371", "372", "373", "374", "375", "376", "377", "378",
  "380", "381", "382", "383", "385", "386", "387", "389", "420", "421",
  "423", "500", "501", "502", "503", "504", "505", "506", "507", "508",
  "509", "590", "591", "592", "593", "594", "595", "596", "597", "598",
  "599", "670", "672", "673", "674", "675", "676", "677", "678", "679",
  "680", "681", "682", "683", "685", "686", "687", "688", "689", "690",
  "691", "692", "850", "852", "853", "855", "856", "870", "880", "886",
  "960", "961", "962", "963", "964", "965", "966", "967", "968", "970",
  "971", "972", "973", "974", "975", "976", "977", "992", "993", "994",
  "995", "996", "998",
].sort((a, b) => b.length - a.length)

export function extractCountryCode(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "")
  for (const code of COUNTRY_CODES) {
    if (digits.startsWith(code)) return code
  }
  return "1"
}

export function calculateWhatsAppCost(
  phoneNumber: string,
  category: string,
  billable: boolean
): number {
  if (!billable) return 0

  const countryCode = extractCountryCode(phoneNumber)
  const rates = RATES_MICRODOLLARS[countryCode] ?? DEFAULT_RATES
  const normalizedCategory = category.toLowerCase() as keyof CategoryRates
  const baseCost = rates[normalizedCategory] ?? DEFAULT_RATES.marketing

  return Math.round(baseCost * MARKUP)
}
