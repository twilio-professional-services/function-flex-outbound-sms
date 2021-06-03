
exports.handler = async function(context, event, callback) {
  
  const {
    ACCOUNT_SID, 
    AUTH_TOKEN,
    TWILIO_PROXY_SERVICE_SID,
    TWILIO_CHAT_SERVICE_SID
  } = context;
  
  const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

  const response = new Twilio.Response();
  
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Iterate through all proxy sessions and clean up individually
  try {
    const sessions = await client.proxy.services(TWILIO_PROXY_SERVICE_SID).sessions.list();
    console.log(`Sessions found: ${sessions ? sessions.length : 0}`);

    if (sessions) {
      for (const session of sessions) {
        // Set chat channel to inactive, then close and remove the proxy session
        // Leaving the chat channel active will result in it being reused (which may be desirable)
        const channelSid = session.uniqueName.substring(0,34);
        const chatChannel = await client.chat.services(TWILIO_CHAT_SERVICE_SID).channels(channelSid).fetch(); 
        let updatedAttributes = JSON.parse(chatChannel.attributes);
        updatedAttributes.status = "INACTIVE";
        await client.chat.services(TWILIO_CHAT_SERVICE_SID).channels(channelSid).update({attributes: JSON.stringify(updatedAttributes)});
        await client.proxy.services(TWILIO_PROXY_SERVICE_SID).sessions(session.sid).update({status: 'closed'});
        await client.proxy.services(TWILIO_PROXY_SERVICE_SID).sessions(session.sid).remove();
        console.log(`Removed session SID '${session.sid}'`);
      }
      response.setBody(`${sessions.length} sessions cleaned up`);
    } else {
      response.setBody('No sessions found');
    }
  } catch (error) {
    response.setStatusCode(error && error.status);
    response.setBody(error);
    return callback(null, response);
  }
      
  return callback(null, response);
}