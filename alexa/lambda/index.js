const DISPLAY_API_URL = process.env.DISPLAY_API_URL;
const CONTROL_API_KEY = process.env.CONTROL_API_KEY;

function assertConfig() {
  if (!DISPLAY_API_URL || !CONTROL_API_KEY) {
    throw new Error(
      'Missing DISPLAY_API_URL or CONTROL_API_KEY. Set both Lambda environment variables before using the skill.'
    );
  }
}

async function callDisplayApi(path, body) {
  assertConfig();

  const baseUrl = DISPLAY_API_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONTROL_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Display API failed (${response.status})`);
  }

  return response.json();
}

function buildResponse(speechText, shouldEndSession = true) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText,
      },
      shouldEndSession,
    },
  };
}

exports.handler = async (event) => {
  const intent = event.request.intent?.name;

  try {
    if (event.request.type === 'LaunchRequest') {
      return buildResponse('Display project ready. Say turn on the display or next widget.', false);
    }

    if (event.request.type === 'SessionEndedRequest') {
      return buildResponse('');
    }

    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
      return buildResponse('Okay, closing display project.');
    }

    if (intent === 'DisplayPowerIntent') {
      const action = event.request.intent.slots?.Action?.value;
      if (!action || !['on', 'off', 'sleep'].includes(action)) {
        return buildResponse(
          'I did not catch that. Please say turn on, turn off, or sleep the display.',
          false
        );
      }

      await callDisplayApi('/api/display/power', { action });
      return buildResponse(`Display turned ${action}.`);
    }

    if (intent === 'NextWidgetIntent') {
      await callDisplayApi('/api/display/widgets/rotate', {});
      return buildResponse('Showing the next widget.');
    }

    if (intent === 'AMAZON.HelpIntent') {
      return buildResponse(
        'You can say turn on the display, turn off the display, sleep the display, or next widget.',
        false
      );
    }

    return buildResponse('Goodbye.');
  } catch (error) {
    console.error(error);
    if (String(error.message || '').includes('Missing DISPLAY_API_URL or CONTROL_API_KEY')) {
      return buildResponse(
        'Display project is not configured. Please set the server URL and control key on the skill.'
      );
    }
    return buildResponse('Sorry, I could not reach the display server.');
  }
};
