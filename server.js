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

async function findEvent(parameters) {
  return new Promise((resolve, reject) => {

    console.log(parameters);
  //Lista av kategorier i visitlinkoping api:
  // sporevent
  // Aktivitet
  // evenemang

  //TODO: Add categories to choose between
  // if(!parameters["category"] && (parameters["activity"] === "football" || parameters["activity"] === "hockey" || parameters["activity"] === "basketball")) {
  //   parameters["category"] = "sportevent";
  //   //TODO: else if More categories
  // } else if(!parameters["category"] && parameters["activity"] === "museum") {
  //   parameters["category"] = "museer";
  // }

  var isEvent = 1;
  if(parameters["passive-or-active"] == "passive") {
    isEvent = 1;
  }
  if(parameters["passive-or-active"] == "active") {
    isEvent = 0;
  }
  console.log("http://visitlinkoping.se/evenemang?q="+parameters["activity"]+"&type="+isEvent+"&category="+parameters["category"]+"&date_from="+parameters["date"]+"&date_to="+parameters["date"]+"&_format=json&render=raw");

  var options = {
    uri: "http://visitlinkoping.se/evenemang?q="+parameters["activity"]+"&type="+isEvent+"&category="+parameters["category"]+"&date_from="+parameters["date"]+"&date_to="+parameters["date"]+"&_format=json&render=raw",
    headers: {
      'User-Agent': 'Request-Promise'
    }
  };

  var apiaiResponse = {
    speech: "",
    displayText: ""
  }

  rp(options)
    .then(function (data) {
        console.log("THE EVENT");
        try {
          jsonArray = JSON.parse(data);
        } catch(error) {
          console.log("JSON.parse(data) crashed"+ error);
          //Remove empty character in json
          data = data.slice(1);
        }
        jsonArray = JSON.parse(data);

        for(var i = 0; i < jsonArray.length; i++) {
          var category = parameters["category"] ? "/"+parameters["category"] : "";
          var title = jsonArray[i].title[0].value;
          console.log(title);
          // var urlTitle = title.replace(/\s+/g, '-').toLowerCase();
          // console.log(urlTitle);
          // if(urlTitle[urlTitle.length-1] === "-") {
          //   urlTitle = urlTitle.slice(urlTitle.length-1);
          //   console.log("SLICE");
          //   console.log(urlTitle);
          // }
          // var url = "http://visitlinkoping.se"+category+"/"+urlTitle;
          var url = "http://www.google.com/search?q=visitlinkoping.se "+title+"&btnI";
          var imgUrl = jsonArray[i].field_image_current[0];
          console.log(url);
          var searchString = parameters["activity"].toLowerCase();

          console.log(searchString);
          // console.log(urlTitle);
          var lowerCaseTitle = title.toLowerCase();
          if(lowerCaseTitle.indexOf(searchString) !== -1 || isEvent) {
            apiaiResponse["speech"] = "I found this event that you may find interesting.";
            apiaiResponse["displayText"] = "I found this event that you may find interesting.";
            apiaiResponse["data"] = {url: url, eventName: title, imgUrl: imgUrl};
            resolve(apiaiResponse)
            return;
          }
        }
        apiaiResponse["speech"] = "Sorry, I couldn't find any event for you";
        apiaiResponse["displayText"] = "Sorry, I couldn't find any event for you";
        resolve(apiaiResponse)
    })
    .catch(function (err) {
      console.log("REJECT");
      apiaiResponse["speech"] = "failed to get data";
      apiaiResponse["displayText"] = "failed to get data";
      reject(apiaiResponse);
    });
  })
  
}

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
        apiaiResponse = await findEvent(parameters);
        break
      default:
        apiaiResponse = "Something went wrong, sorry!";
        break
    }

    res.send(JSON.stringify(apiaiResponse))
});

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

      var messageData;

      if(response.result.fulfillment.data && response.result.fulfillment.data.eventName 
        && response.result.fulfillment.data.url && response.result.fulfillment.data.imgUrl) {
        messageData = {
          recipient: {
            id: recipientId
          },
          "message":{
            "attachment":{
              "type":"template",
              "payload":{
                "template_type":"generic",
                "elements":[
                   {
                    "title":response.result.fulfillment.data.eventName,
                    "image_url":response.result.fulfillment.data.imgUrl,
                    "buttons":[
                      {
                        "type":"web_url",
                        "url":response.result.fulfillment.data.url,
                        "title":"More information"
                      }             
                    ]      
                  }
                ]
              }
            }
          }
        }
      } else {
        messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: response.result.fulfillment.speech
          }
        };
      }

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