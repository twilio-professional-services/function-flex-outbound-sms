# Initiating Outbound SMS From Flex
There are a number of use cases around specifically _initiating_ outbound SMS from Flex - that are not off-the-shelf capabilities within the Flex UI. Since the Flex UI reacts to Tasks, these typically originate from an inbound message coming in _from_ the customer - at which point an agent can converse with the customer via the Flex Chat UI interface. Sometimes though, we (the agent, CRM, or external system) need to be the _initiators_ of the SMS conversation.

The functions in this repository provide support for initiating outbound SMS - either as an agent, via a Task (see `functions\flex-initiate-outbound-sms-task.js`) or as an external system or any other fire-and-forget message sending source (see `functions\flex-initiate-outbound-sms.js`. 

## Example Use Cases for Both Functions
1. Agent clicks an "SMS" button against a customer in their CRM (or a custom CRM Flex plugin). This triggers a task, which can route directly to agent via workflow filtering, and then they can send the initial message & converse in native Flex Chat UI. See `functions/flex-initiate-outbound-sms-task.js`
2. Other enterprise system fires off an automated message, and we want this message to be part of a resulting conversation (i.e. chat channel) - even if all further messages are between customer and Studio flow. See `functions/flex-initiate-outbound-sms.js` - no task needed here)
3. Customer types "CHAT" via SMS - to reach an agent - and we initiate a switch from an automated message system (e.g. a Studio Flex Flow mapped to a short code phone number) to a direct agent conversation (Task Flex Flow mapped to different 10DLC phone number). We can call `functions/flex-initiate-outbound-sms-task.js` from the Studio Flow - to make this happen.


# Twilio Function: Initiate Outbound SMS with Task

## Overview

When an agent needs to send an outbound SMS message to a customer, it may be desired to have them send the message using the stock Flex UI chat interface. This Twilio Function (`functions/flex-initiate-outbound-sms-task.js`) makes this possible by creating a chat task for the agent and setting up the backend resources so messages the agent adds to the chat are sent to the mobile number via SMS (and vice versa)

To do this, the function essentially triggers the following behavior using the Twilio REST APIs:

1. The creation of a Chat Channel to represent the SMS conversation in Flex UI (or reuse of existing one)
2. The creation of a Proxy Session between the desired Twilio From number and the customer's number
3. The automatic creation of a Task via a Task Flex Flow associated with the Twilio number

Please review this entire README to ensure all pre-requisites are met and in place prior to using the Function.

## Long-Lived Considerations
This Flex Flow setting is covered below, and allows all Chat Channels to live beyond the default completion
point, which is either when an agent ends the chat with the customer - via the Flex UI - or when the [Channel Janitor](https://www.twilio.com/docs/flex/developer/messaging/manage-flows#channel-janitor) reacts to a task finishing. Simply enabling this flag will allow your conversation with the customer to be retained beyond the lifecycle of the task.

It is important to note that housekeeping measures will need to be put in place - if using long-lived channels - to ensure the Chat Channels are eventually cleaned up (clear the long-lived flag and set to INACTIVE). We have another Github repository [here](https://github.com/twilio-professional-services/clear-long-lived-channels) with an approach for managing this using Twilio Sync and Event Streams!

## How to use the Function

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
to present that historical chat channel message history to the agent (either from Flex Chat APIs or from a CRM). [We have a plugin](https://github.com/twilio-professional-services/plugin-chat-include-source-chat-channel) that does exactly this! 

If the Function executes successfully, you should receive a `200 OK` response with a response body containing details on the Chat Channel and Proxy Session.

If the function does not execute successfully, you'll receive an HTTP error code and the response body will contain the details of why it failed.

### Expected outcome of the Function call
When the Function executes successfully, the following resources are created:

1. A new chat channel (if there isn't already an ACTIVE Chat Channel between the two phone numbers for the specified Flex Flow). If the Flex Flow's `LongLived` parameter is set to `true`, it's also possible an existing long-lived Chat Channel could be returned. See 'Create Direct to Task Flex Flow' section below for more details there.
2. A new chat task with the `sourceChatChannelSid` attribute set (if supplied)
3. A new Proxy session tied to the chat channel. This ensure that any messages the agent adds to the chat are sent to the customer's mobile number via SMS, and any messages received from the customer's mobile number are added to the chat so the agent sees them.

When the receiving agent accepts the task in Flex, they will be joined to the chat channel and any messages they add to the chat will be sent via SMS to the customer's mobile number.
# Twilio Function: Initiate Outbound SMS (Fire-and-Forget)
## Overview

When a back-office system needs to send an automated outbound SMS message to a customer, or if an agent wants to manually send a notification message  to a customer without engaging with them in a task/conversation, this Twilio Function (`functions/flex-initiate-outbound-sms.js`) will do the same logic as the task-driven SMS usecase above, but instead of initiating a Chat Channel using a Task Flex Flow, we use a regular Studio Flex Flow - such that any response that comes in from the customer, will pass through our Studio Flow as normal, and the conversation history will include the originating outbound messages from our Function.

The function essentially does the following using the Twilio REST APIs:

1. The creation of a Chat Channel to represent the SMS conversation in Flex UI (or reuse of existing one) - associated to Studio flow this time.
2. The creation of a Proxy Session between the desired Twilio From number and the customer's number
3. The sending of a message to the Chat Channel - resulting in the Proxy Service picking up this message and sending onto customer via SMS

Please review this entire README to ensure all pre-requisites are met and in place prior to using the Function.

## How to use the Function

You can invoke the Function as a JSON REST API call. The request body should be a JSON object with these properties:
```
{
  "fromNumber": "+1555XXXXXXX",
  "toName": "Customer Name",
  "toNumber": "+1555XXXXXXX",
  "messageBody": "Ahoy from Twilio!"

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
* messageBody
  * The message we want to send to the customer

If the Function executes successfully, you should receive a `200 OK` response with a response body containing details on the Chat Channel, the Proxy Session, and the chat message.

If the function does not execute successfully, you'll receive an HTTP error code and the response body will contain the details of why it failed.

### Expected outcome of the Function call
When the Function executes successfully, the following resources are created:

1. A new chat channel (if there isn't already an ACTIVE Chat Channel between the two phone numbers for the specified Flex Flow). If the Flex Flow's `LongLived` parameter is set to `true`, it's also possible an existing long-lived Chat Channel could be returned. 
2. A new Proxy session tied to the chat channel. This ensure that any messages added to the chat are sent to the customer's mobile number via SMS, and any messages received from the customer's mobile number are added to the same chat.
3. A new message on the chat channel - which is relayed to the customer's phone number by the Proxy Service

# Twilio CLI Deployment Instructions (Recommended)
This is the recommended approach - for ease of code management and deployment automation.

1. Make sure you have Node.js as well as npm installed
   - npm version 5.0.0 or later (type `npm -v` in your terminal to check)
   - Node.js version 12 or later (type `node -v` in your terminal to check)

2. Clone this repository

```
git clone https://github.com/twilio-professional-services/function-flex-outbound-sms.git
```

3. Install dependencies

  ```
  npm install
  ```

4. Make a copy of `.env.example`

    ```bash
    cp .env.example .env
    ```

5. Open `.env` with your text editor and set the environment variables mentioned in the file.

    ```
    ACCOUNT_SID=ACxxx
    AUTH_TOKEN=xxxxx
    TWILIO_CHAT_SERVICE_SID=ISxxx
    TWILIO_PROXY_SERVICE_SID=KSxxx
    ```

   - TWILIO_PROXY_SERVICE_SID can be found on the [Proxy Dashboard](https://www.twilio.com/console/proxy)
   - Note: The `TWILIO_CHAT_SERVICE_SID` value is only needed for the (as-yet-undocumented) `flex-cleanup-all-proxy-sessions.js` convenience function - for use in development testing only.

6. Deploy the Twilio Functions to your account
  
    ```bash
    npm run deploy-and-override
    ```
    
    Example output:

    ```bash
    #twilio-run deploy --override-existing-project
    #
    #Deploying functions & assets to the Twilio Runtime
    #...
    #
    #✔ Serverless project successfully deployed
    #
    #Deployment Details
    #Domain: function-flex-outbound-sms-3705-dev.twil.io
    #...
    #Functions:
    #  https://function-flex-outbound-sms-3705-dev.twil.io/flex-cleanup-all-proxy-sessions
    #  https://function-flex-outbound-sms-3705-dev.twil.io/flex-initiate-outbound-sms
    #  https://function-flex-outbound-sms-3705-dev.twil.io/flex-initiate-outbound-sms-task
    #...
    ```

# Manual Deployment Instructions
Skip this if you followed the (recommended) CLI steps above.

1. Create Serverless Service and Functions
If you have an existing Twilio Serverless Service you want to place this function in, go ahead and use it, otherwise create a new Service
via [Functions > Services](https://www.twilio.com/console/functions/overview/services) > Create Service.

Then go ahead and add 2 new functions pasting in the code located at `functions\flex-initiate-outbound-sms.js` and/or `functions\flex-initiate-outbound-sms-task.js`. Click Save when done with each.

2. Create Function Environment Variables
Follow these steps to ensure all required environment variables are available for the Function to use:

1. In your Twilio Console, navigate to Runtime -> Functions -> [Configure](https://www.twilio.com/console/runtime/functions/configure).
2. Make sure **Enable ACCOUNT_SID and AUTH_TOKEN** is checked
3. Under **Environment Variables** add the following:
    * **Key: TWILIO_PROXY_SERVICE_SID**
      * **Value**: The SID of the desired Proxy service found on the [Proxy Dashboard](https://www.twilio.com/console/proxy)
4. Click Save at the bottom of the window if the button is enabled

## Add Function Node Package Dependencies
Follow these steps to ensure all required Node packages are available for the Function(s) to use:

1. In your Twilio Console, navigate to Runtime -> Functions -> [Configure](https://www.twilio.com/console/runtime/functions/configure).
2. Under **Dependencies** add the following (only name is required; version can be left blank, unless you want to lock the package to a specific release):
    * **[uuidv4](https://www.npmjs.com/package/uuidv4)**
      * Simple, fast generation of RFC4122 UUIDS
      * Used in our Function to create a unique identifier for the chat channel Identity parameter
3. Click Save at the bottom of the window if the button is enabled
    
## Deploy the Function(s)
Click the Deploy All button from the Function editor, and wait for the deploy to complete.

# Create Necessary Flex Flows
Flex Flows define how messages intended to reach the Flex UI should be handled. You can see your Flex Flows in the Twilio Console at Flex -> [Messaging](https://www.twilio.com/console/flex/numbers). You will need a separate Flex Flow for each unique Twilio number.

Typically inbound messages are routed to a default Flex Messaging Studio Flow and then to Flex using the Studio Send to Flex widget. The Send to Flex widget will create a task on the specified Workflow SID for routing to a Worker. For the System-Initiated SMS use case (`functions/flex-initiate-outbound-sms.js`), this default Flex Flow is adequate. The cURL command for creating a new Studio Flex Flow is defined below anyway, just in case you ever need to recreate.

For the Agent-Initiated SMS use case however (`functions/flex-initiate-outbound-sms-task.js`), we already have the task created by our function (to allow the agent to pick it up and send the first message). To allow the Function to do this, a Task Flex Flow needs to be associated with our inbound number. The cURL command for creating this is below also.

NOTE: You are allowed both a Studio AND a Task integration Flex Flow against a Twilio Phone Number. The Proxy Service will default to the Studio one whenever a new message arrives and is not part of an active Proxy session.

1. First we'll need to gather the following information required for our Flex Flow API calls
    * Twilio Account Sid and Auth Token
    * Twilio number(s) to be used for sending/receiving SMS messages
    * Chat Service SID
      * In your Twilio Console, navigate to Programmable Chat -> [Services](https://www.twilio.com/console/chat/services) and copy the SID for the desired chat service
    * (Studio Flow only) Studio Flow SID
      * In your Twilio Console, navigate to Studio -> [Manage Flows](https://www.twilio.com/console/studio/flows) and copy the SID for the desired flow (e.g. Messaging Flow)      
    * (Task Flow only) TaskRouter Workspace SID
      * In your Twilio Console, navigate to TaskRouter -> [Workspaces](https://www.twilio.com/console/taskrouter/workspaces) and copy the SID for the desired workspace
    * (Task Flow only) TaskRouter Workflow SID
      * In your Twilio Console, navigate to TaskRouter -> Workspaces -> [_YourWorkspace_] -> Workflows and copy the SID for the workflow you want to send the task to
    * (Task Flow only) TaskRouter TaskChannel SID
      * In your Twilio Console, navigate to TaskRouter -> Workspaces -> [_YourWorkspace] -> TaskChannels and copy the SID for the Programmable Chat TaskChannel

2. Call the Flex Flow API to create your Flex Flow(s)
   a. Creating a Studio Flex Flow
    Here is the API call to create a Studio Flex Flow if needed - using cURL. NOTE: This is typically not needed, as Flex creates a Flex Messaging Studio Flow by default - for new phone numbers on a Flex account. Replace the params mentioned above, with the values from your Twilio account.

    ```
    curl -X POST https://flex-api.twilio.com/v1/FlexFlows \
    --data-urlencode “IntegrationType=studio” \
    --data-urlencode “Enabled=True” \
    --data-urlencode “Integration.FlowSid=FWXXXXXX” \
    --data-urlencode “FriendlyName=Flex Messaging Channel Flow” \
    --data-urlencode “ContactIdentity=+1888XXXXXXX” \
    --data-urlencode “ChannelType=sms” \
    --data-urlencode "LongLived=false" \
    --data-urlencode "JanitorEnabled=true" \
    --data-urlencode “ChatServiceSid=ISXXXXXX” \
    -u ACXXXXXX:XXXXXXX
    ```

   b. Creating a Task Flex Flow
    Here is the API call to create a Task Flex Flow if needed - using cURL. Replace the params mentioned above, with the values from your Twilio account.

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

Here is an explanation of each parameter from the above API calls:
    * ChannelType
      * `web` or `sms`
      * Using `sms` defines this flow for SMS messages
    * IntegrationType
      * `studio` or `task`
      * Using `task` indicates this is a Direct to Task flow
    * Enabled
      * `true` or `false`
      * Controls whether initial inbound messages will consider this flow or not
      * Using `false` for the Task flow, since this flow is only triggered by manually creating a chat channel via our Function
      * NOTE: If you want out-of-session messages arriving on the associated phone number (i.e. messages sent after 
      agent completed the task) to create a new task, you'll want to set this to `true` - unless you have another flow
      that handles this - such as a Studio Flow.
    * FriendlyName
      * `string` value
      * Allows for easy identification of this flows purpose when looking through the list of Flex Flows
    * ContactIdentity
      * `string` value
      * Must be the Twilio phone number that will be used to send/receive SMS messages
    * ChatServiceSid
      * `string` value
      * SID of the Programmable Chat Service to use for this Flex Flow
      * `string` value
      * SID of the Studio Flow to use for this Flex Flow
    * (Task Flow only) Integration.WorkspaceSid
      * `string` value
      * SID of the TaskRouter Workspace to use for the task that's created on chat channel creation
    * (Task Flow only) Integration.WorkflowSid
      * `string` value
      * SID of the TaskRouter Workflow to use for the task that's created on chat channel creation
    * (Task Flow only) Integration.Channel
      * `string` value
      * SID of the TaskRouter TaskChannel to use for the task that's created on chat channel creation
      * This must be the Programmable Chat channel in order to support messaging
    * LongLived
      * `true` or `false`
      * If `true`, the chat channel will not be closed when the agent ends the chat. This means that the entire chat history will be retained. New chat tasks that are subsequently created will display the previous chat history to the receiving agent.
      * If `false`, the chat channel will be closed when the agent ends the chat. This means that each new chat task will be a new chat channel, with none of the previous chat messages displayed in this channel.
    * JanitorEnabled
      * `true` or `false`
        * If `true`, a janitor process will listen for task completion events and cleanup the chat channel per the LongLived setting above (as a backup in case the Flex UI channel cleanup doesn't execute)

3. After making the API call, you will receive a `201 Created` response with the Flex Flow details in the response body if it worked successfully
4. The System-Initiated SMS function (`functions/flex-initiate-outbound-sms.js`) will dynamically locate the correct Studio Flex Flow based on the `fromNumber` property passed into the Function call. Similarly, the Agent-Initiated SMS function (`functions/flex-initiate-outbound-sms-task.js`) will locate the correct Task Flex Flow.
