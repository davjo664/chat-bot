var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var apiai = require('apiai');
var rp = require('request-promise');
 
var apiaiApp = apiai("a23d026b36b2408eb12aa97a867a2b81");
var app = express();

app.set('port', (process.env.PORT || 5000));

//To process the data
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', function(request, response) {
  response.send("Hello world");
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.post('/apiai', async function(req, res) {
   const body = req.body

    const action = body.result.action
    const parameters = body.result.parameters
    // const conexts = body.results.contexts

    var apiaiResponse = {
      speech: "",
      displayText: ""
    }

    console.log('Action: ', action, 'Parameters: ', parameters)

    switch (action) {
      //Todo add to Actions emum
      case 'event': 
        apiaiResponse = await findEvent(parameters)
        break
      default:
        apiaiResponse = 'Something went wrong, sorry!'
        break
    }

    res.send(JSON.stringify(apiaiResponse))
});

async function findEvent(parameters) {
  var parameters = {
    activity: parameters["activity"],
    address: parameters["address"],
    category: parameters["category"],
    category: parameters["date"]
  }

  var options = {
    uri: 'http://visitlinkoping.se/evenemang?q=&type=1&category=Aktivitet&date_from=2017-02-10&date_to=2017-08-04&_format=json&render=raw',
    headers: {
        'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };

  try {
    const data = await rp(options)
    console.log(data);
    return "data collected";
  } catch(error) {
    return "Failed"; 
  }

}

app.get('/messanger', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === "davjo664_verify") {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

app.post('/messanger', function (req, res) {
// var messaging = req.body.entry[0].messaging;
if (req.body.object === 'page') {

	// Iterate over each entry - there may be multiple if batched
	req.body.entry.forEach(function(entry) {
	  var pageID = entry.id;
	  var timeOfEvent = entry.time;

	  // Iterate over each messaging event
	  entry.messaging.forEach(function(event) {
	    if (event.message) {
	      receivedMessage(event);
	    } else if (event.postback) {
          receivedPostback(event);
      } else {
	      console.log("Webhook received unknown event: ", event);
	    }
	  });
	});

	res.sendStatus(200);
}
});

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'generic':
        sendGenericMessage(senderID);
        break;
      case 'button':
        sendButtonMessage(senderID);
        break;

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          "template_type":"button",
          "text":"What do you want to do next?",
          "buttons":[
            {
              "type":"postback",
              "title":"Sport events",
              "payload":"event_sport"
            },
            {
              "type":"postback",
              "title":"Social events",
              "payload":"event_social"
            },
            {
              "type":"web_url",
              "url":"https://www.google.se/maps",
              "title":"Show on google maps"
            }
          ]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendTextMessage(recipientId, messageText) {

  var request = apiaiApp.textRequest(messageText, {
      sessionId: recipientId
  });
   
  request.on('response', function(response) {
      console.log("Success!!");
      console.log(response);

      var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: response.result.fulfillment.speech
          }
        };

        callSendAPI(messageData);

  });
   
  request.on('error', function(error) {
    console.log("Error!!");
      console.log(error);
  });
   
  request.end();
}

function callSendAPI(messageData) {
  var PAGE_ACCESS_TOKEN = "EAAGWlbh1JEcBADaQrxYlyO8hCoKVWZAHP5Ku2DAcQ9ZCCc1AIjq4yWZAxMZCmBs43NYjCKJR5vYXEWYtgjZCXez2HiPPuvtZBRzHeR22d9ISXncCN4eeBrNZBxLzy0B2vocTSVlnZCX1pZBcAaDkYqrZAjsaoNU93vhNaEDBvGu2GHgZBVL7bAPZCuSl";
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}