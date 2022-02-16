import needle from 'needle'
import cheerio from 'cheerio'
import moment from 'moment'
import cryptojs from 'crypto-js'
import ics from 'ics'
import { writeFileSync } from 'fs'
import ora from 'ora'
import { parse, format } from 'date-fns'

controller()

async function controller() {
  try {
    let spinner = ora("Generating Cinematheque events").start()
    let finalEvents = []
    let calendarEvents = []
    spinner.text = "Getting film list"
    let content = await needle("get", "https://thecinematheque.ca/films")
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

      writeFileSync(`../calendars/c.ics`, value)
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
      decodeEntities: false
    })
    $(".filmImg").each(function() {
      links.push(
        $(this)
          .find("a")
          .attr("href")
      )
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
      decodeEntities: true
    })
    let url = $("meta[property='og:url']")
      .attr("content")
      .split("/")
    let year = url[4]
    let target = "/" + url[3] + "/" + url[4] + "/" + url[5]
    let screenings = $("#screenings")
      .find("li")
      .toArray()
      .map(function(x) {
        return $(x)
          .text()
          .trim()
          .replace(/ *\([^)]*\) */g, "")
      })

    let ampm = $("#screenings")
      .find('li span.time')
      .toArray()
      .map(function(r) {
        return $(r)
          .attr("class")
          .split(" ")[1]
          // .replace(/time/g, "")
      })
    let combi = screenings.map((d, i) => `${d}${ampm[i]}`)

    let title = $(".filmTitle")
      .text()
      .trim()
      // .replace(/:/g, '')
    let rawDuration = $(".filmRuntime").text()

    // loop over screenings
    combi.map(function(s) {
      var hash = cryptojs.SHA256(title + s)
      var uniqueId = hash.toString(cryptojs.enc.Base64).substr(0, 32)
      // convert duration from minutes to hours and minutes
      var duration = parseInt(rawDuration)
      var durationHours = Math.floor(duration / 60)
      var durationMinutes = duration % 60
      // in case the day is today
      if (s.startsWith("Today")) {
        var today = moment().format("MMMM D") + s.replace("Today", "")
        // var finalDate = moment(today, ["MMMM D h:ma"]).subtract(1, "hours")
        var finalDate = moment(today, ["MMMM D h:ma"])
      } else if (s.startsWith("Tomorrow")) {
        // get tomorrow
        var tomorrow =
          moment()
            .add(1, "days")
            .format("MMMM D") + s.replace("Tomorrow", "")
        // var finalDate = moment(tomorrow, ["MMMM D h:ma"]).subtract(1, "hours")
        var finalDate = moment(tomorrow, ["MMMM D h:ma"])
      } else {
        var finalDate = moment(s, ["MMMM D h:ma"])
        // var finalDate = moment(s, ["MMMM D h:ma"]).subtract(1, "hours")
      }

      let start = moment(finalDate)
        // .add(9, "hours")
        .format("YYYY-M-D-H-m")
        .split("-")
      // need to convert object values to numbers
      Object.keys(start).forEach(function(el) {
        start[el] = parseInt(start[el])
      })

      let event = {
        title: title,
        description: target,
        start: start,
        location: "The Cinematheque",
        duration: { hours: durationHours, minutes: durationMinutes },
        uid: uniqueId
      }

      events.push(event)
    })
    return events
  } catch (error) {
    console.log(error)
  }
}
