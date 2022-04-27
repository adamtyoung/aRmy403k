import { parse, format } from 'date-fns'
import puppeteer from 'puppeteer'
import cryptojs from 'crypto-js'
import ics from 'ics'
import { writeFileSync } from 'fs'
import ora from 'ora'

const events = []
const spinner = ora('Scraping VIFF movies').start()

function run(pagesToScrape) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!pagesToScrape) {
        pagesToScrape = 1
      }
      spinner.text = 'Scraping ' + pagesToScrape + ' pages'
      const browser = await puppeteer.launch()
      const page = await browser.newPage()
      await page.goto("https://riotheatre.ca")
      let currentPage = 1
      let urls = []
      while (currentPage <= pagesToScrape) {
        let newUrls = await page.evaluate(() => {
          const results = []
          let items = document.querySelectorAll(".schedule-carousel .poster-header")
          items.forEach((item) => {
            results.push({
              title: item.querySelector(".poster-title").innerText,
              // date: 'Wednesday, March 23, 2022 at 5:30 PM',
              date: item.querySelector(".date").innerText + ' ' + item.querySelector(".time").innerText,
              description: "https://riotheatre.ca/movie/" + item.querySelector(".poster-title").innerText.replace(/ *\(.*$/g, "").replace(/\s+/g, '-').toLowerCase(),
            })
          })
          return results
        })
        urls = urls.concat(newUrls)
        if (currentPage < pagesToScrape) {
          await Promise.all([
            await page.$eval("li.av-paging-links a.page-link span", (el) =>
              el.click()
            ),
            await page.waitForSelector(".item-description"),
          ])
        }
        spinner.text = 'Scraping page ' + currentPage
        currentPage++
      }
      browser.close()
      return resolve(urls)
    } catch (e) {
      return reject(e)
    }
  })
}
// run(2).then(console.log).catch(console.error);
run(1)
  .then((value) => {
    //
    value.forEach(function (element) {
      // get the date
      // let inDate = element.date.replace(/,/g, "").replace(" at", "")
      let fixed = parse(element.date, "EEE MMM d h:m a", new Date())
      let finalDate = format(fixed, "y-M-d-H-m").split("-")
      Object.keys(finalDate).forEach(function (el) {
        finalDate[el] = parseInt(finalDate[el])
      })

      // hash an ID
      var hash = cryptojs.SHA256(element.title + element.date)
      var uniqueId = hash.toString(cryptojs.enc.Base64).substr(0, 32)

      const event = {
        title: element.title,
        description: element.description,
        start: finalDate,
        location: "Rio Theatre",
        duration: { hours: 2, minutes: 30 },
        uid: uniqueId,
      }
      events.push(event)
    })

    ics.createEvents(events, (error, value) => {
      if (error) {
        console.log(error)
        return
      }

      spinner.text = 'Writing to ICS file'
      writeFileSync(`../calendars/r.ics`, value)
      spinner.succeed('All done')
    })
    //
  })
  .catch(console.error)
