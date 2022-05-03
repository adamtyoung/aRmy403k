import needle from "needle"
import cheerio from "cheerio"
import cryptojs from "crypto-js"
import ics from "ics"
import { writeFileSync } from "fs"
import ora from "ora"
import { parse, format } from "date-fns"

controller()

async function controller() {
  try {
    let spinner = ora("Generating VIFF events").start()
    let finalEvents = []
    let calendarEvents = []
    spinner.text = "Getting film list"
    let content = await needle("get", "https://viff.org/whats-on/")
    let linkList = await getLinks(content)
    spinner.text = "Getting and processing each film"
    for (var i = 0, len = linkList.length; i < len; i++) {
      let cleanLink = linkList[i].replace(/^http:\/\//i, "https://")
      cleanLink = encodeURI(cleanLink)
      let pageContent = await needle("get", cleanLink)
      let detail = await extractInfo(pageContent)
      finalEvents.push(detail)
    }
    calendarEvents = finalEvents.flat()
    spinner.text = "Writing events to ics file"
    ics.createEvents(calendarEvents, (error, value) => {
      if (error) {
        console.log(error)
        return
      }

      writeFileSync(`../calendars/v.ics`, value)
      spinner.succeed("All done")
    })
  } catch (error) {
    console.log(error)
  }
}

function getLinks(content) {
  try {
    let links = []
    var $ = cheerio.load(content.body, {
      decodeEntities: false,
    })
    $(".c-event-card__content").each(function () {
      links.push($(this).find("h3 a").attr("href"))
    })
    return links
  } catch (error) {
    console.log(error)
  }
}

function extractInfo(content) {
  try {
    let events = []
    let $ = cheerio.load(content.body, {
      decodeEntities: true,
    })
    let url = $("meta[property='og:url']").attr("content")
    let title = $("meta[property='og:title']")
      .attr("content")
      .split("|")[0]
      .trim()

    let duration = $(".event__duration").text().replace(' min', '')

    // get dates
    const screenings = []
    $("section .c-event__instances .c-event-instance__date-group").each(
      (index, element) => {
        let group = cheerio.load(element)
        let day = group("h4").text().trim()
        let times = group(".c-event-instance__time").text().trim()
        let timesArr = times.split("\n")
        timesArr = cleanNames(timesArr)

        // screenings.push(day + cleanNames(timesArr))
        timesArr.forEach((time) => {
          let oneLine = day + ' ' + time
          screenings.push({
            title: title,
            date: oneLine,
            description: url,
            duration: duration
          })
        })
        // end
      }
    )

    screenings.forEach(function (element) {
      var hash = cryptojs.SHA256(element.title + element.date)
      var uniqueId = hash.toString(cryptojs.enc.Base64).substr(0, 32)

      let finalDate = parse(element.date, "EEEE MMMM dd h:mm a", new Date())
      let start = format(finalDate, "y-M-d-H-m").split("-")

      // need to convert duration in min to hours and min 
      var hours = (element.duration / 60);
      var rhours = Math.floor(hours);
      var minutes = (hours - rhours) * 60;
      var rminutes = Math.round(minutes);

      // need to convert object values to numbers
      Object.keys(start).forEach(function (el) {
        start[el] = parseInt(start[el])
      })

      let event = {
        title: element.title,
        description: element.description,
        start: start,
        location: "Vancity Theatre",
        duration: { hours: rhours, minutes: rminutes },
        uid: uniqueId,
      }

      if (!Number.isNaN(start[0])) {
      events.push(event)
      }
    })
    return events

  } catch (error) {
    console.log(error)
  }
}

function cleanNames(arr) {
  return arr.map(function (element) {
    return element.trim()
  })
}
