import ping from 'ping'
import axios from 'axios'

const DOMAINS = ['google.com', 'facebook.com', 'twitter.com']
const TIMEOUT = 300 // ms
const INTERVAL = 500 // ms
const MAX_TRIES = 4
const DISCORD_WEBHOOK_URL = ''
const DEBUG = false

/*
    @param {string} domain
    @returns {Promise<{ domain: string, status: boolean }>}
 */
async function customPing(domain) {
    try {
        let res = await awaitWithTimout(await ping.promise.probe(domain), TIMEOUT)
        const { alive, time } = res
        return { domain, status: alive && time < TIMEOUT }
    } catch (error) {
        console.error(`Error pinging ${domain}:`, error)
        return { domain, status: false }
    }
}

/*
    @param {string} errorMessage
    @returns {Promise<void>}
 */
async function logErrorToDiscord(errorMessage) {
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === '') {
        console.error('No Discord webhook URL provided')
    }

    try {
        await axios.post(DISCORD_WEBHOOK_URL, { content: errorMessage })
        if (DEBUG) {
            console.log('Error logged to Discord:', errorMessage)
        }
    } catch (error) {
        console.error('Error logging error to Discord:', error)
    }
}

/*
    @param {Promise<any>} promise
    @param {number} ms
 */
async function awaitWithTimout(promise, ms) {
    return await Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject('Timeout'), ms))])
}

async function main() {
    const tracker = DOMAINS.reduce((acc, domain) => {
        acc[domain] = 0
        return acc
    }, {})

    setInterval(async () => {
        try {
            const results = await Promise.all(DOMAINS.map(domain => customPing(domain)))

            results.forEach(({ domain, status }) => {
                if (status) {
                    if (DEBUG) {
                        console.log(`Domain ${domain} is up`)
                    }
                    tracker[domain] = 0
                } else {
                    tracker[domain]++
                    if (tracker[domain] >= MAX_TRIES) {
                        if (DEBUG) {
                            console.log(`Domain ${domain} is down`)
                        }
                        logErrorToDiscord(`Domain ${domain} is down`)
                        tracker[domain] = 0
                    }
                }
            })
        } catch (error) {
            console.error('Error during ping operations:', error)
        }
    }, INTERVAL)
}

await main()