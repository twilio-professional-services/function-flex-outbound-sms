# Twilio Function: Initiate Outbound SMS Task

## Overview

When an agent needs to send an outbound SMS message to a customer, it may be desired to have them send the message using 
the stock Flex UI chat interface. This Twilio Function makes this possible by creating a chat task for the agent and 
setting up the backend resources so messages the agent adds to the chat are sent to the mobile number via SMS (and vice versa)

To do this, the function essentially triggers the following behavior using the Twilio REST APIs:

1. The creation of a Chat Channel to represent the SMS conversation in Flex UI (or reuse of existing one)
2. The creation of a Proxy Session between the desired Twilio From number and the customer's number
3. The automatic creation of a Task via the pre-existing (see below) Flex Flow associated with the Twilio number

Please review this entire README to ensure all pre-requisites are met and in place prior to using the Function.

## Future Improvements
Note that this function does not cover all scenarios. It assumes there's no existing task (and consequently no proxy session), and so it
*always* creates a new proxy session. A useful improvement would be to check for the existence of a Proxy Session already (maybe in the 
Chat Channel attributes), and skip creating the session that case.

There's also the idea of long-lived channels. This Flex Flow setting allows a Chat Channel to live beyond the default completion
point, which is either when an agent ends the chat with the customer - via the Flex UI - or when the [Channel Janitor](https://www.twilio.com/docs/flex/developer/messaging/manage-flows#channel-janitor) reacts to a task finishing. 

# How to use the Function
## Example REST request
You can invoke the Function as a JSON REST API call. The request body should be a JSON object with these properties:
```
{
  "fromNumber": "+1555XXXXXXX",
  "toName": "Customer Name",
  "toNumber": "+1555XXXXXXX",
  "sourceChatChannelSid": "CHXXXXXX"

}
```
Here is an explanation of each property:

* fromNumber
  * This is the Twilio number that will be used to send/receive SMS messages
* toName
  * This is the name of the customer the agent is communicating with
  * The name entered here will show up as the customer name on the task and in the chat channel
* toNumber
  * This is the mobile number of the customer the agent is communicating with
* sourceChatChannelSid
  * (Optional) If this function is being triggered from some other pre-existing chat conversation - perhaps from an automated Studio 
flow - it may be desirable to include the source Chat Channel's SID, so that the Flex UI can be used (i.e. customized via a plugin)
to present that historical chat channel message history to the agent (either from Flex Chat APIs or from a CRM)
## Example REST response
If the Function executes successfully, you should receive a `200 OK` response with a response body similar to the following:
```
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
```
If the function does not execute successfully, you'll receive an HTTP error code and the response body will contain the details of why it failed.

## Expected outcome of the Function call
When the Function executes successfully, the following resources are created:

1. A new chat channel (if the Flex Flow `LongLived` parameter is set to `false`. See 'Create Direct to Task Flex Flow' section below for more details)
2. A new chat task with the `sourceChatChannelSid` attribute set (if supplied)
3. A new Proxy session tied to the chat channel. This ensure that any messages the agent adds to the chat are sent to the customer's mobile number via SMS, and any messages received from the customer's mobile number are added to the chat so the agent sees them.

When the receiving agent accepts the task in Flex, they will be joined to the chat channel and any messages they add to the chat will be sent via SMS to the customer's mobile number.

# Deployment Instructions
## Create Function Environment Variables
Follow these steps to ensure all required environment variables are available for the Function to use:

1. In your Twilio Console, navigate to Runtime -> Functions -> [Configure](https://www.twilio.com/console/runtime/functions/configure).
2. Make sure **Enable ACCOUNT_SID and AUTH_TOKEN** is checked
3. Under **Environment Variables** add the following:
    * **Key: TWILIO_PROXY_SERVICE_SID**
      * **Value**: The SID of the desired Proxy service found here ([Proxy Dashboard](https://www.twilio.com/console/proxy))
4. Click Save at the bottom of the window if the button is enabled

## Add Function Node Package Dependencies
Follow these steps to ensure all required Node packages are available for the Function to use:

1. In your Twilio Console, navigate to Runtime -> Functions -> [Configure](https://www.twilio.com/console/runtime/functions/configure).
2. Under **Dependencies** add the following (only name is required; version can be left blank, unless you want to lock the package to a specific release):
    * **[uuidv4](https://www.npmjs.com/package/uuidv4)**
      * Simple, fast generation of RFC4122 UUIDS
      * Used in our Function to create a unique identifier for the chat channel Identity parameter
3. Click Save at the bottom of the window if the button is enabled
    
## Create Direct to Task Flex Flow
Flex Flows define how messages intended to reach the Flex UI should be handled. You can see your Flex Flows in the Twilio Console at Flex -> [Messaging](https://www.twilio.com/console/flex/numbers).

Typically inbound messages are routed to a Studio Flow and then to Flex using the Studio Send to Flex widget. The Send to Flex widget will create a task on the specified Workflow SID for routing to a Worker.

However, the use case this Function handles requires that inbound messages be routed directly to the chat channel. The Function creates a task as part of its process, so we don't want the inbound message to hit a Studio Flow which creates a new task. 

For this to happen, we need to use the Flex Flows API to create a Direct to Task Flex Flow associated with our inbound number. You will need a separate Flex Flow for each unique Twilio number.

NOTE: YOu are allowed both a Studio AND a Task integration Flex Flow against a Twilio Phone Number. The Proxy Service will default to the Studio one, unless an 
existing session exists. 

Follow these steps to create a Direct to Task Flex Flow:

1. First, we'll need to gather the following information required for our API call
    * Twilio Account Sid and Auth Token
    * Twilio number to be used for sending/receiving SMS messages
    * Chat Service SID
      * In your Twilio Console, navigate to Programmable Chat -> [Services](https://www.twilio.com/console/chat/services) and copy the SID for the desired chat service
    * TaskRouter Workspace SID
      * In your Twilio Console, navigate to TaskRouter -> [Workspaces](https://www.twilio.com/console/taskrouter/workspaces) and copy the SID for the desired workspace
    * TaskRouter Workflow SID
      * In your Twilio Console, navigate to TaskRouter -> Workspaces -> [_YourWorkspace_] -> Workflows and copy the SID for the workflow you want to send the task to
    * TaskRouter TaskChannel SID
      * In your Twilio Console, navigate to TaskRouter -> Workspaces -> [_YourWorkspace] -> TaskChannels and copy the SID for the Programmable Chat TaskChannel
2. Here is the API call using curl. You can of course use any API tool you prefer, such as Postman. Replace the parameter values with the information you gathered.
```
curl -X POST \
  https://flex-api.twilio.com/v1/FlexFlows \
  --data-urlencode "ChannelType=sms" \
  --data-urlencode "IntegrationType=task" \
  --data-urlencode "Enabled=false" \
  --data-urlencode "FriendlyName=Flex SMS To Task Flow" \
  --data-urlencode "ContactIdentity=+1888XXXXXXX" \
  --data-urlencode "ChatServiceSid=ISXXXXXX" \
  --data-urlencode "Integration.WorkspaceSid=WSXXXXXX" \
  --data-urlencode "Integration.WorkflowSid=WWXXXXXX" \
  --data-urlencode "Integration.Channel=TCXXXXXX \
  --data-urlencode "LongLived=false" \
  --data-urlencode "JanitorEnabled=true" \
 -u ACXXXXXX:XXXXXXX
 ```
3. Here is an explanation of each parameter:
    * ChannelType
      * `web` or `sms`
      * Using `sms` defines this flow for SMS messages
    * IntegrationType
      * `studio` or `task`
      * Using `task` indicates this is a Direct to Task flow
    * Enabled
      * `true` or `false`
      * Controls whether initial inbound messages will consider this flow or not
      * Using `false` since this flow is only triggered by manually creating a chat channel
    * FriendlyName
      * `string` value
      * Allows for easy identification of this flows purpose when looking through the list of Flex Flows
    * ContactIdentity
      * `string` value
      * Must be the Twilio phone number that will be used to send/receive SMS messages
    * ChatServicesSid
      * `string` value
      * SID of the Programmable Chat Service to use for this Flex Flow
    * Integration.WorkspaceSid
      * `string` value
      * SID of the TaskRouter Workspace to use for the task that's created on chat channel creation
    * Integration.WorkflowSid
      * `string` value
      * SID of the TaskRouter Workflow to use for the task that's created on chat channel creation
    * Integration.Channel
      * `string` value
      * SID of the TaskRouter TaskChannel to use for the task that's created on chat channel creation
      * This must be the Programmable Chat channel in order to support messaging
    * LongLived
      * `true` or `false`
      * If `true`, the chat channel will not be closed when the agent ends the chat. This means that the entire chat history will be retained. New chat tasks that are subsequently created will display the previous chat history to the receiving agent.
      * If `false`, the chat channel will be closed when the agent ends the chat. This means that each new chat task will be a new chat channel, with none of the previous chat messages displayed in this channel.
4. After making the API call, you will receive a `201 Created` response with the Flex Flow details in the response body if it worked successfully
5. Validate the `integration` object details and that `integration_type` is `task`
6. If all that is true then the Flex Flow is ready for use
7. The Function will dynamically locate this Flex Flow based on the `fromNumber` property passed into the Function call