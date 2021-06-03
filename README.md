# Twilio Function: Send Outbound SMS as Flex Conversation

## Overview
Due to the way Flex utilizes Programmable Chat Channels to represent SMS conversations, any outbound SMS messages sent 
outside of this Flex framework will not be visible to an agent whenever handling a customer reply.

This function creates the necessary parts of this framework - namely the CHat Channel and the Flex Proxy Service session - 
to enable the message to be sent via the Programmable Chat conversation versus using the Programmable SMS APIs. This 
ensures the message remains on the conversational history for that Chat Channel for as long as that channel remains active,
and allows the agent to see the full context around the customer's message history (both received and sent).

Please review this entire README to ensure all pre-requisites are met and in place prior to using the Function.

## Future Improvements
Note that this function does not cover all scenarios. It assumes the message being sent is the initial message, and that no 
Flex Proxy Session exists. A useful improvement would be to check for the existence of a Proxy Session already, and use that.

There's also the idea of long-lived channels. This Flex Flow setting allows a Chat Channel to live beyond the default completion
point, which is either when an agent ends the chat with the customer - via the Flex UI - or when the [Channel Janitor](https://www.twilio.com/docs/flex/developer/messaging/manage-flows#channel-janitor) reacts to a task finishing

How to use the Function
Example REST request
You can invoke the Function as a JSON REST API call. The request body should be a JSON object with these properties:

{
  "fromNumber": "+1555XXXXXXX",
  "toName": "Customer Name",
  "toNumber": "+1555XXXXXXX"
}
Here is an explanation of each property:

fromNumber
This is the Twilio number that will be used to send/receive SMS messages
toName
This is the name of the customer the agent is communicating with
The name entered here will show up as the customer name on the task and in the chat channel
toNumber
This is the mobile number of the customer the agent is communicating with
Example REST response
If the Function executes successfully, you should receive a 200 OK response with a response body similar to the following:

{
  "chatChannel": {
    "identity": "08d8c950-8d3c-11e9-b8c4-db01a11a1915",
    "task_sid": "{u'prefix': u'WT', u'bytes': u'XXXXXX', u'value': u'WTXXXXXXX', u'compact_hex': u'XXXXXXX'}",
    "flex_flow_sid": "FOXXXXXX",
    "account_sid": "ACXXXXXX",
    "user_sid": "USXXXXXX",
    "url": "https://flex-api.twilio.com/v1/Channels/CHXXXXXX",
    "sid": "CHXXXXXX"
  },
  "proxySession": {
    "sid": "KCXXXXXX",
    "serviceSid": "KSXXXXXX",
    "accountSid": "ACXXXXXX",
    "dateStarted": null,
    "dateEnded": null,
    "dateLastInteraction": null,
    "dateExpiry": null,
    "uniqueName": "CHXXXXXX",
    "status": "open",
    "closedReason": null,
    "ttl": 0,
    "mode": "message-only",
    "dateCreated": "2019-06-12T18:01:00.000Z",
    "dateUpdated": "2019-06-12T18:01:00.000Z",
    "url": "https://proxy.twilio.com/v1/Services/KS6ddbd5dc6b48116d468cbb7c2902882e/Sessions/KCXXXXXX",
    "links": {
      "participants": "https://proxy.twilio.com/v1/Services/KSXXXXXX/Sessions/KCXXXXXX/Participants",
      "interactions": "https://proxy.twilio.com/v1/Services/KSXXXXXX/Sessions/KCXXXXXX/Interactions"
    }
  }
}
If the function does not execute successfully, you'll receive an HTTP error code and the response body will contain the details of why it failed.

Expected outcome of the Function call
When the Function executes successfully, the following resources are created:

A new chat channel (if the Flex Flow LongLived parameter is set to false. See 'Create Direct to Task Flex Flow' section below for more details)
A new chat task with the targetWorkerPhone attribute to ensure it goes only to the worker with a matching phone attribute (see 'How to match task to requesting worker' section below for more details)
A new Proxy session tied to the chat channel. This ensure that any messages the agent adds to the chat are sent to the customer's mobile number via SMS, and any messages received from the customer's mobile number are added to the chat so the agent sees them.
When the receiving agent accepts the task in Flex, they will be joined to the chat channel and any messages they add to the chat will be sent via SMS to the customer's mobile number.
