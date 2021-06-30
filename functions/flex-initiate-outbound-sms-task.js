const { v4: uuidv4 } = require('uuid');

exports.handler = async function(context, event, callback) {

  const {
    ACCOUNT_SID, 
    AUTH_TOKEN,
    TWILIO_PROXY_SERVICE_SID,
  } = context;
  const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

  
  const {
    fromNumber,
    toName,
    toNumber,
    initialNotificationMessage,
    sourceChatChannelSid
  } = event;
  
  /**
   * Validate mandatory fields are supplied
   */
  const verifyEventProps = () => {
    const result = {
      success: false,
      errors: []
    };
    
    if (!fromNumber) result.errors.push("Missing 'fromNumber' in request body");
    else if (!toName) result.errors.push("Missing 'toName' in request body");
    else if (!toNumber) result.errors.push("Missing 'toNumber' in request body");
    else result.success = true;

    return result;
  }
  
  /**
   * Looks for the sms Flex Flow matching the supplied fromNumber.
   * NOTE: It only looks for the *task* integration type (as there can be multiple Flex Flows
   * per number) 
   */
  const getFlexFlowForNumber = async () => {
    let flexFlow;
    console.debug(`Looking for Flex Flow for fromNumber '${fromNumber}'`); 
    try {
      const flexFlows = await client.flexApi.flexFlow.list();
      
      flexFlow = flexFlows.find(
        flow => flow.integrationType === 'task' && flow.contactIdentity === fromNumber
      );
    } catch (error) {
      console.error(`Error finding Flex Flow!`, error);
      throw error;      
    }

    console.debug(`Flow Flow is:\n ${JSON.stringify(flexFlow)}'`); 
    return flexFlow;
  }

  /**
   * Creates the SMS Chat Channel - using the Flex API
   */
  const createSMSChatChannelWithTask = async (flexFlowSid, identity) => {
    let channel;
    console.debug(`Creating SMS Chat Channel to '${toNumber}' using Flex Flow SID '${flexFlowSid}' and identity '${identity}'`); 
    
    const taskAttributes = {
      to: toNumber,
      direction: 'outbound',
      name: toName,
      from: fromNumber,
      sourceChatChannelSid
      // Add any of your own desired attributes here
    };

    try {
      channel = await client.flexApi.channel
          .create(
            {
              target: toNumber,
              identity: identity,
              chatUserFriendlyName: toName,
              chatFriendlyName: `SMS${toNumber}`,
              flexFlowSid: flexFlowSid,
              taskAttributes: JSON.stringify(taskAttributes)
            });
    } catch (error) {
      console.error(`Error creating SMS Chat Channel!`, error);
      throw error;      
    }
    
    console.debug(`SMS Chat Channel is:\n ${JSON.stringify(channel)}'`); 
    return channel;
  }
  
  /**
   * Creates the Flex Proxy Service session to be used for the SMS conversation. Reuses existing one if there
   * is one
   */
  const createProxySession = async (chatChannelSid) => {
    let proxySession;

    // Look for existing session first
    try {
      const proxySessions = await client.proxy.services(TWILIO_PROXY_SERVICE_SID).sessions.list();

      proxySession = proxySessions.find(
        session => session.uniqueName === chatChannelSid
      );

      if (proxySession) {
        console.debug(`Found EXISTING Flex Proxy Session between Chat Channel SID '${chatChannelSid}' and toNumber '${toNumber}'`); 
        return proxySession;
      }
    } catch (error) {
      console.error(`Error looping through existing Flex Proxy Sessions!`, error);
      throw error;      
    }

    console.debug(`Creating Flex Proxy Session between Chat Channel SID '${chatChannelSid}' and toNumber '${toNumber}'`); 
    
    const participants = [
      {
        Identifier: toNumber,
        ProxyIdentifier: fromNumber,
        FriendlyName: toName
      }, {
        Identifier: chatChannelSid,
        ProxyIdentifier: fromNumber,
        FriendlyName: toName
      },
    ];
    
    try {
      proxySession = await client.proxy.services(TWILIO_PROXY_SERVICE_SID)
        .sessions
        .create({
          uniqueName: chatChannelSid,
          participants: JSON.stringify(participants),
          mode: 'message-only'
        });
    } catch (error) {
      console.error(`Error creating Flex Proxy Session!`, error);
      throw error;      
    }
    
    console.debug(`Proxy Session is:\n ${JSON.stringify(proxySession)}'`); 
    return proxySession;
  }
  
    
  
  /**
   * Send the message, using the Chat Channel. Proxy Session will be listening to this channel's events
   * and will send the outbound SMS.
   */
  const sendMessageViaChatChannel = async (chatChannelSid) => {
    
    let chatMessage;
    console.debug(`Sending the message '${initialNotificationMessage}' from fromNumber '${fromNumber}' to toNumber '${toNumber}' using Chat Channel SID '${proxySessionSid}'`); 
    
    try {
      chatMessage = await client.chat.services(chatServiceSid)
                  .channels(chatChannelSid)
                  .messages
                  .create({body: initialNotificationMessage}); // From defaults to "system"
    } catch (error) {
      console.error(`Error sending message via Chat Channel!`, error);
      throw error;      
    }
    
    console.debug(`Chat Message is:\n ${JSON.stringify(chatMessage)}'`); 
    return chatMessage;
  }  
  
  
  // *******************************
  // ORCHESTRATION LOGIC BEGINS HERE
  // *******************************
  const response = new Twilio.Response();
  
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  const eventCheck = verifyEventProps(event);
  if (!eventCheck.success) {
    console.log('Event property check failed.', eventCheck.errors);
    response.setStatusCode(400);
    response.setBody({ status: 400, errors: eventCheck.errors });
    return callback(null, response);
  }

  let flexFlow;
  try {
    flexFlow = await getFlexFlowForNumber();
  } catch (error) {
    response.setStatusCode(error && error.status);
    response.setBody(error);
    return callback(null, response);
  }
  if (!flexFlow) {
    response.setStatusCode(500);
    response.setBody({ message: 'Unable to find matching Flex Flow' });
    return callback(null, response);
  } 

  const chatServiceSid = flexFlow.chatServiceSid;
  const flexFlowSid = flexFlow.sid;
  console.log('Matching Flex Flow Chat Service SID:', chatServiceSid);
  console.log('Matching Flex Flow SID:', flexFlowSid);

  const identity = uuidv4();

  let chatChannel;
  try {
    chatChannel = await createSMSChatChannelWithTask(flexFlowSid, identity);
  } catch (error) {
    response.setStatusCode(error && error.status);
    response.setBody(error);
    return callback(null, response);
  }
  if (!chatChannel) {
    response.setStatusCode(500);
    response.setBody({ message: 'Failed to create Chat Channel' });
    return callback(null, response);
  }
  if (!chatChannel.sid) {
    response.setStatusCode(chatChannel.status);
    response.setBody(chatChannel);
    return callback(null, response);
  }
  const chatChannelSid = chatChannel.sid;
  console.log(`Chat channel SID is '${chatChannelSid}'`);
  const responseBody = { chatChannel: { identity } };
  Object.keys(chatChannel).forEach((key) => {
    // Excluding private properties from the response object
    if (!key.startsWith('_')) {
      responseBody.chatChannel[key] = chatChannel[key];
    }
  });

  let proxySession;
  try {
    proxySession = await createProxySession(chatChannelSid);
  } catch (error) {
    response.setStatusCode(error && error.status);
    response.setBody(error);
    return callback(null, response);
  }
  if (!proxySession) {
    response.setStatusCode(500);
    response.setBody({ message: 'Failed to create Proxy Session' });
    return callback(null, response);
  }
  if (!proxySession.sid) {
    response.setStatusCode(proxySession.status);
    response.setBody(proxySession);
    return callback(null, response);
  }
  const proxySessionSid = proxySession.sid;
  console.log(`Proxy Session SID is '${proxySessionSid}'`);
  
  responseBody.proxySession = {};
  Object.keys(proxySession).forEach((key) => {
    // Excluding private properties from the response object
    if (!key.startsWith('_')) {
      responseBody.proxySession[key] = proxySession[key];
    }
  });
  
  if (initialNotificationMessage) {
    // An intial message to the customer is specified, so send this via chat channel
    let chatMessage;
    try {
      chatMessage = await sendMessageViaChatChannel(chatChannelSid);
    } catch (error) {
      response.setStatusCode(error && error.status);
      response.setBody(error);
      return callback(null, response);
    }
    if (!chatMessage) {
      response.setStatusCode(500);
      response.setBody({ message: 'Failed to create Chat Message' });
      return callback(null, response);
    }
    if (!chatMessage.sid) {
      response.setStatusCode(chatMessage.status);
      response.setBody(chatMessage);
      return callback(null, response);
    }

    responseBody.chatMessage = {};
    Object.keys(chatMessage).forEach((key) => {
      // Excluding private properties from the response object
      if (!key.startsWith('_')) {
        responseBody.chatMessage[key] = chatMessage[key];
      }
    });
  }
  
  response.setBody(responseBody);
  return callback(null, response);
};