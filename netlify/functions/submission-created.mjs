const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = "dispatch@spacecitycruisecollective.com";
const FROM_NAME = "Space City Cruise Collective Dispatch";
const DISPATCH_EMAIL = "dispatch@spacecitycruisecollective.com";

async function sendEmail(apiKey, { to, subject, textBody, replyTo }) {
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    content: [{ type: "text/plain", value: textBody }],
  };

  if (replyTo) {
    payload.reply_to = { email: replyTo };
  }

  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error (${response.status}): ${errorText}`);
  }
}

function buildQuoteAutoResponse() {
  return `Hello,

We received your escort quote request and a member of dispatch will review it shortly.

Space City Cruise Collective provides pilot car and escort support for oversize and overweight loads across Texas and select regional routes. We operate with a compliance-focused approach built around permit awareness, direct communication, and fast response times.

What happens next:
- We review your route, dimensions, timing, and escort requirements
- Dispatch follows up with availability and pricing
- If needed, we may request permit details or additional load information

To speed up quoting, reply to this email with any of the following:
- Permit copy
- Load dimensions
- Origin and destination
- Requested pickup date/time
- Escort type needed (lead, chase, or both)

Typical response time:
Under 15 minutes during business hours when complete load details are provided.

Thank you,
Dispatch
Space City Cruise Collective
dispatch@spacecitycruisecollective.com
(832) 956-0054`;
}

function buildDocumentsAutoResponse() {
  return `Hello,

We received your document request.

Dispatch will review your request and send the appropriate documents as quickly as possible. Available onboarding documents may include:
- Certificate of Insurance (COI)
- WITPAC certification
- Washington State PEVO certification
- Additional company documentation as requested

To help us process this faster, reply with:
- Company name
- Contact name
- Load or project reference
- Certificate holder details (for COI requests)
- Any specific documents needed

Thank you,
Dispatch
Space City Cruise Collective
dispatch@spacecitycruisecollective.com
(832) 956-0054`;
}

function buildInternalAlert(formName, data) {
  const label =
    formName === "quote"
      ? "Escort Quote Request"
      : "Document Request";

  let lines = [`New ${label} Submission`, ""];

  const fieldLabels = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    company: "Company",
    service: "Service Needed",
    message: "Details / Message",
    documents: "Documents Requested",
  };

  for (const [key, value] of Object.entries(data)) {
    if (!value || key === "form-name" || key === "bot-field" || key === "subject") continue;
    const label = fieldLabels[key] || key;
    lines.push(`${label}: ${value}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("This is an automated notification from the Space City Cruise Collective website.");

  return lines.join("\n");
}

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    console.error("Failed to parse request body:", e);
    return;
  }

  const { payload } = body;
  if (!payload) {
    console.error("No payload in submission event");
    return;
  }

  const apiKey = Netlify.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    console.error(
      "SENDGRID_API_KEY environment variable is not set. Email auto-responses will not be sent."
    );
    return;
  }

  const formName = payload.form_name;
  const data = payload.data || {};
  const submitterEmail = data.email;

  try {
    if (formName === "quote" && submitterEmail) {
      // Send auto-response to the person who submitted the quote request
      await sendEmail(apiKey, {
        to: submitterEmail,
        subject: "Quote Request Received | Space City Cruise Collective",
        textBody: buildQuoteAutoResponse(),
        replyTo: DISPATCH_EMAIL,
      });

      // Send internal alert to dispatch with all form details
      await sendEmail(apiKey, {
        to: DISPATCH_EMAIL,
        subject: `New Escort Quote Request from ${data.name || "Website"}`,
        textBody: buildInternalAlert("quote", data),
        replyTo: submitterEmail,
      });

      console.log(`Quote auto-response and internal alert sent for: ${submitterEmail}`);
    } else if (formName === "documents" && submitterEmail) {
      // Send auto-response to the person who requested documents
      await sendEmail(apiKey, {
        to: submitterEmail,
        subject: "Document Request Received | Space City Cruise Collective",
        textBody: buildDocumentsAutoResponse(),
        replyTo: DISPATCH_EMAIL,
      });

      // Send internal alert to dispatch with all form details
      await sendEmail(apiKey, {
        to: DISPATCH_EMAIL,
        subject: `New Document Request from ${data.name || "Website"}`,
        textBody: buildInternalAlert("documents", data),
        replyTo: submitterEmail,
      });

      console.log(`Document auto-response and internal alert sent for: ${submitterEmail}`);
    } else {
      console.log(`No email handler for form "${formName}" or missing email address.`);
    }
  } catch (error) {
    console.error(`Failed to send emails for ${formName} submission:`, error);
  }
};
