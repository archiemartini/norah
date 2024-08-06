require("dotenv").config();

const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");

// Settings
const env = process.env;
const URL = env.TICKET_URL || "https://www.twickets.live/catalog/browse";
const ARTIST = env.ARTIST || "Norah Jones";
const LOCATION = env.LOCATION || "London";
const smtpConfig = {
  host: env.SMTP_HOST || "smtp.mailgun.org",
  port: parseInt(env.SMTP_PORT, 10) || 587, // must be integer
  secure: false, // upgrade later with STARTTLS
  auth: {
    user: env.SMTP_USER || "",
    pass: env.SMTP_PASS || "",
  },
};
const EMAIL_SEND_TYPE = env.EMAIL_SEND_TYPE || "gmail";
const gmailConfig = {
  service: "gmail",
  auth: {
    user: env.GMAIL_USER || "",
    pass: env.GMAIL_PASS || "",
  },
};
let monitoring = true;

async function sendEmail() {
  const transporter = nodemailer.createTransport(
    EMAIL_SEND_TYPE.toLowerCase() === "gmail" ? gmailConfig : smtpConfig
  );

  console.log("Sending email...");
  try {
    return await transporter.sendMail(
      {
        from: env.EMAIL_FROM || "",
        to: env.EMAIL_TO || "",
        subject: env.EMAIL_SUBJECT || "Ticket Available",
        text:
          (env.EMAIL_TEXT ||
            "The ticket you were waiting for is now available! ") + ` ${URL}`,
      },
      (err, info) => {
        if (err) {
          console.error(
            `Error sending email: ${JSON.stringify(err)}, ${JSON.stringify(
              info
            )}`
          );
        } else {
          console.log("Email sent!");
          // console.log(info);
        }
      }
    );
  } catch (e) {
    console.error(e);
  }
}

async function checkElement(selector, textToMatch, page) {
  return await page.evaluate(
    (selector, textToMatch) => {
      const element = document.querySelector(selector);
      console.log(selector, element.textContent);
      return element && element.textContent.includes(textToMatch);
    },
    selector,
    textToMatch
  );
}

async function checkTicketAvailability() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
    });
    const page = await browser.newPage();
    const locationSelector = ".multi-select-style input";
    let ticketFound = false;

    // This will log all console messages from the page
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(locationSelector);
    await page.click(locationSelector);
    await page.keyboard.type(LOCATION);
    await page.keyboard.press("Enter");
    // wait 3 seconds for the location to be selected
    await new Promise((resolve) => setTimeout(resolve, 3000));

    for (let i = 0; i < 3; i++) {
      const artistSelector = `#searchBlockResult_eventName_${i}`;
      const locationSelector = `#searchBlockResult_venueLocation_${i}`;

      await page.waitForSelector(artistSelector);
      await page.waitForSelector(locationSelector);

      const isCorrectArtist = await checkElement(artistSelector, ARTIST, page);
      const isCorrectLocation = await checkElement(
        locationSelector,
        LOCATION,
        page
      );

      if (isCorrectArtist && isCorrectLocation) {
        ticketFound = true;
        break;
      }
    }

    return ticketFound;
  } catch (e) {
    console.error(e);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function monitor() {
  while (monitoring) {
    const available = await checkTicketAvailability();
    if (available) {
      console.log("Ticket is available!");
      sendEmail().finally(() => {
        monitoring = false;
      });
    } else {
      const INTERVAL_IN_SECONDS = Math.floor(
        Math.random() * (120 - 10 + 1) + 10
      );
      console.log(
        `Ticket is not available yet. Retrying... in ${INTERVAL_IN_SECONDS} seconds`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, INTERVAL_IN_SECONDS * 1000)
      );
    }
  }
}

async function startMonitoring() {
  await monitor();
  process.exit(0);
}

process.on("SIGINT", () => {
  console.log("Stopping the monitor...");
  monitoring = false;
  process.exit();
});

startMonitoring();
