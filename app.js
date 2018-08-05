/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  //'username': process.env.CONVERSATION_USERNAME,
  //'password': process.env.CONVERSATION_PASSWORD,
  'version_date': '2017-05-26'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  
  /*if (!response.output) {
    response.output = {};
  } else {
    return response;
  }*/

  var context = response.context;

  // pizza
  if (response.intents[0] && response.intents[0]['intent'] == 'yes' && 
    context['confirmation'] == '(true || false) && slot_in_focus') {
    console.log('Add to order: pizza');

    var pizza = {
      type: 'pizza',
      size: context['pizza_size'], 
      crust: context['pizza_crust'], 
      toppings: context['pizza_toppings']
    };

    context['order'].push(pizza);
    context['pizza_size'] = null;
    context['pizza_crust'] = null;
    context['pizza_toppings'] = null;
    context['confirmation'] = null;
  }

  // stromboli
  if (context['stromboli']) {
    console.log('Add to order: stromboli');

    var stromboli = {
      type: 'stromboli',
      stromboli: context['stromboli']
    };

    context['order'].push(stromboli);
    context['stromboli'] = null;
  }

  // salad
  if (context['salad_type'] && (context['salad_type'] == 'Caesar salad' || 
    (context['salad_type'] && context['salad_dressing']))) {
    console.log('Add to order: salad');

    var salad = {
      type: 'salad',
      salad_type: context['salad_type'],
      salad_dressing: context['salad_dressing']
    };

    context['order'].push(salad);
    context['salad_type'] = null;
    context['salad_dressing'] = null;
  }

  // side
  if (context['side']) {
    console.log('Add to order: side');

    var side = { 
      type: 'side',
      side: context['side'] 
    };

    context['order'].push(side);
    context['side'] = null;
  }

  // drink
  if (context['drink']) {
    console.log('Add to order: drink');

    var drink = { 
      type: 'drink',
      drink: context['drink'] 
    };

    context['order'].push(drink);
    context['drink'] = null;
  }

  // checkout
  if ((response.intents[0] && response.intents[0]['intent'] == 'checkout') ||
        context['goto_checkout']) {
    var order = context['order'];
    var order_str = 'Your final order is: <br> <blockquote>';

    for (var i=0; i < order.length; i++) {
      if (order[i]['type'] == 'pizza') {
        var temp_str = 'A ' + order[i]['size'] + ' ' + order[i]['crust'] + ' crust pizza with ';

        if (order[i]['toppings'].length == 2) {
          temp_str += order[i]['toppings'][0] + ' and ' + order[i]['toppings'][1] + ' <br>';
        } else {
          temp_str += order[i]['toppings'].join(', ') + ' <br>';
        }

        order_str += temp_str;

      } else if (order[i]['type'] == 'stromboli') {
        order_str += 'A stromboli <br>'

      } else if (order[i]['type'] == 'salad') {
        if (order[i]['salad_type'] == 'Caesar salad') {
          order_str += 'A Caesar salad <br>'
        } else {
          order_str += 'A garden salad with ' + order[i]['salad_dressing'] + ' <br>';
        }

      } else if (order[i]['type'] == 'side') {
        order_str += 'An order of breadstisks <br>';

      } else if (order[i]['type'] == 'drink') {
        order_str += 'A ' + order[i]['drink'] + ' <br>';
      }
    }

    order_str += '</blockquote>' + 
      'Don\'t worry about payment. This one\'s on us! <br>' +
      'I already know where to deliver this. <br>' +
      'Thank you ' + context['name'] + ' and come talk to me again soon!';
    response.output.text = order_str;
  }
  
  response.context = context;
  return response;
}

module.exports = app;
