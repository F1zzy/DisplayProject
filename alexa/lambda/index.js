const DISPLAY_API_URL = process.env.DISPLAY_API_URL;
const CONTROL_API_KEY = process.env.CONTROL_API_KEY;

async function callDisplayApi(path, body) {
  const response = await fetch(`${DISPLAY_API_URL}${path}`, {
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
    return buildResponse('Sorry, I could not reach the display server.');
  }
};
