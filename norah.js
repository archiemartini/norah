require('dotenv').config()

const puppeteer = require('puppeteer');

const URL = 'https://www.twickets.live/catalog/browse';
// personalise
const ARTIST = 'Norah Jones'
const LOCATION = 'London'

const nodemailer = require('nodemailer');

async function sendEmail() {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'archie.cgm@gmail.com',
            pass: process.env.NODEMAILER_GOOGLE_PASSWORD
        }
    });

    let info = await transporter.sendMail({
        from: 'archie.cgm@gmail.com',
        to: 'archie.cgm@gmail.com',
        subject: 'Ticket Available',
        text: 'The ticket you were waiting for is now available! https://www.twickets.live/catalog/browse'
    });

    console.log('Email sent: ' + info.response);
}


async function checkElement(selector, textToMatch, page) {
  return await page.evaluate((selector, textToMatch) => {
      const element = document.querySelector(selector);
      console.log(selector, element.textContent)
      return element && element.textContent.includes(textToMatch);
  }, selector, textToMatch);
}

async function checkTicketAvailability() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // This will log all console messages from the page
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto(URL, { waitUntil: 'networkidle2' });

  let ticketFound = false;

  for (let i = 0; i < 3; i++) {
      const artistSelector = `#searchBlockResult_eventName_${i}`;
      const locationSelector = `#searchBlockResult_venueLocation_${i}`;

      await page.waitForSelector(artistSelector);
      await page.waitForSelector(locationSelector);
      
      const isCorrectArtist = await checkElement(artistSelector, ARTIST, page);
      const isCorrectLocation = await checkElement(locationSelector, LOCATION, page);
      
      if (isCorrectArtist && isCorrectLocation) {
          ticketFound = true;
          break;
      }
  }

  await browser.close();
  return ticketFound;
}


async function monitor() {
    while (true) {
        if (await checkTicketAvailability()) {
            console.log('Ticket is available!');
            sendEmail();
            break;
        } else {
            console.log('Ticket is not available yet. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

monitor();
