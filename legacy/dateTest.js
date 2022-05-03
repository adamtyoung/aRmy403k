import { parse, format, isToday, isValid } from "date-fns"

let myDate = 'Tuesday May 03 4:00 pm'
let parsedDate = parse(myDate, "EEEE MMMM dd h:mm a", new Date())

const isValidDate = isValid(parsedDate)
console.log(' In: ' + myDate + ' Out ' + parsedDate + ' Valid ' + isValidDate)
console.log(isToday(new Date()))