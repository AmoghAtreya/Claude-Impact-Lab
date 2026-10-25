# Technician Service Intake App — Idea Summary

## Overview

The idea is a browser-based service intake app that helps contractors and technicians collect information from customers before a service visit. A contractor sends a customer a link through a familiar messaging channel, such as iMessage or WhatsApp. The customer opens the link and starts by taking or uploading a photo of the problem. AI analyzes the image, generates relevant questions, and adapts its follow-up questions to the customer’s answers. It then analyzes the photos and responses together and automatically updates the contractor portal with a structured service brief. The customer never needs to download an app, create an account, or log in.

The product has two sides: a contractor-facing component for the service business and a customer-facing component for submitting service information. The central product requirement is to make participation as immediate and frictionless as possible.

This summary combines the original discussion with the subsequent product decisions: photo-first intake, AI-generated adaptive questions, and automatic analysis of customer responses to update the contractor portal. Suggested implementation details are identified separately.

## The Problem

When someone needs a repair, they want a straightforward way to explain the problem and move toward getting it fixed. The discussion uses HVAC as an example: a customer whose home is too hot wants the issue resolved quickly.

The proposed app makes the initial information-gathering step simple. Customers can respond through a browser link delivered in a messaging app they already use.

A broader product hypothesis is that collecting useful information before a visit could reduce repetitive questions and help technicians prepare. That benefit is a reasonable interpretation of the intake concept; the excerpt does not provide customer research or measured evidence confirming it.

## Target Customer

### Paying customer: service businesses and contractors

The likely business customer is a contractor or service company that needs to collect information from people requesting repairs or maintenance.

The discussion explicitly mentions plumbers and HVAC providers. Other trades are explored as possibilities, including machinery repair, garage and mechanical repairs, automotive and truck repair, security systems, fire alarms, and telephone equipment services.

These are potential markets discussed during brainstorming. The team does not select a final trade or customer segment in the provided excerpt.

### Day-to-day business user: technicians and service staff

Technicians, contractors, or staff coordinating jobs would use the business-facing component. The contractor portal presents the customer’s photos, responses, and an AI-generated service brief so the team can understand the request before a visit.

### Customer-facing user: the person requesting service

The other user is the person who needs help with a repair or service issue. This person interacts with the app through the shared link and form.

For an HVAC use case, this could be a resident whose cooling system is not working. For plumbing, it could be someone reporting a leak or another plumbing problem.

The customer should be able to complete the interaction without adopting a new application or managing another account.

## Confirmed Product Requirements

### 1. No customer app download

Avoiding an additional app is described as a hard requirement. The customer experience must work in a browser.

### 2. No customer account creation or login

Customers should be able to open the link, complete the form, and submit it directly. Registration and login should not interrupt this flow.

This requirement applies to the customer-facing experience. The excerpt does not specify how contractors authenticate.

### 3. Links shared through existing messaging channels

The team describes sending a browser link through iMessage, WhatsApp, or whichever messaging channel the customer already uses.

This establishes link sharing as the interaction model. It does not establish that the MVP must integrate directly with messaging APIs or send messages automatically.

### 4. Two product components

The app needs a contractor-facing component and a customer-facing component. The team describes these as the contractor and client sides of the product.

### 5. Minimal friction

The intended customer journey is short: receive a link, open it, photograph the problem, answer relevant AI-generated questions, and submit. The questions should collect useful details without unnecessary repetition.

### 6. Photo-first, adaptive intake

The intake starts with a photo of the problem. AI analyzes the image and generates questions tailored to what it can observe rather than showing every customer the same standardized questionnaire. Follow-up questions adapt to the answers and can request another photo when useful.

### 7. AI analysis and contractor portal updates

AI analyzes all of the customer’s responses together with the photos and automatically updates the associated service request in the contractor portal. The contractor receives an organized account of the problem rather than having to interpret a collection of raw form answers. The original photos and answers remain available alongside the generated summary.

## Core Workflow

1. **The contractor creates an intake request and shares its link.** The customer receives it through an existing conversation, such as iMessage or WhatsApp.
2. **The customer opens the link in a browser.** No download, account, or login is required.
3. **The customer takes or uploads a photo of the problem.** This is the starting point of intake, rather than a long generic questionnaire.
4. **AI analyzes the image.** It identifies visible equipment, symptoms, labels, or other relevant details and distinguishes observations from uncertain interpretations.
5. **AI generates a tailored set of questions.** The questions address information needed to understand this particular issue, including facts a photo cannot reveal.
6. **The customer answers and the questions adapt.** Follow-up questions reflect the answers already given. The app may request another view or a close-up when that would clarify the issue.
7. **AI analyzes the full intake.** It combines all responses and photos into a coherent service brief, preserving the customer’s statements and identifying unresolved details.
8. **The contractor portal updates automatically.** The associated request reflects the collected information, generated summary, and any remaining questions. Whether updates happen after each response or on submission remains an implementation decision.
9. **The technician reviews the request before the visit.** The technician can read the brief and inspect the supporting photos and original answers.

## Suggested Information to Collect

Questions are generated dynamically from the photo and subsequent answers. Relevant topics could include:

- A description of the issue in the customer's own words.
- When the issue started and whether it is ongoing or intermittent.
- The affected equipment or area.
- Relevant photos.
- Equipment make or model, if known.
- Access details or other information needed for the visit.
- Contact or location details that the contractor does not already have.

These are suggested information categories, not a fixed questionnaire. The AI should ask only for details relevant to the particular issue and avoid asking customers to repeat information already provided.

## Example: HVAC Service Request

A customer contacts an HVAC business because their home is too hot and the cooling system is not working as expected.

The business sends a browser link through its existing conversation with the customer. The customer opens it and uploads a photo showing water beneath an HVAC unit.

The AI generates questions about when the water appears, whether cooling still works, and where the customer first noticed the leak. If an answer introduces a new detail, the next question reflects it. The app may ask for a closer photo of a label or affected area.

AI then analyzes the complete set of answers and photos and updates the contractor portal with the reported symptoms, timing, relevant equipment information, and unanswered questions. The technician can review both the summary and the original material before the visit.

The intake supports preparation. Possible explanations should be labeled as uncertain; the technician remains responsible for diagnosis. Pricing, booking, and a guaranteed repair outcome are not established features.

## The Contractor-Facing Component

The contractor portal is the business-facing workspace for intake requests. Automatic updates from AI analysis are a core part of the concept.

Its core responsibilities are to:

- Create and share a customer intake link.
- Keep each intake associated with the correct service request.
- Receive the customer’s photos and complete responses.
- Display an AI-generated summary based on all submitted information.
- Reflect new customer information in the request as intake is processed.
- Keep supporting answers and images accessible for technician review.

A proposed service request view could show:

| Portal information | Purpose |
| --- | --- |
| Problem summary | Explain the customer’s request at a glance. |
| Customer photos | Provide the visual context used during intake. |
| Reported symptoms and timeline | Capture what the customer says is happening and when. |
| Equipment details | Show make, model, labels, or error codes when available. |
| Question-and-answer history | Preserve the full intake for review. |
| Missing or conflicting information | Show details that still need confirmation. |
| Intake status | Indicate whether information is still being collected or is ready for review. |

These display fields are proposed implementation details. Scheduling, payments, dispatch, and external job-management integrations remain outside the confirmed scope.

## The Customer-Facing Component

This is the clearest part of the agreed concept. It should provide:

- A browser-accessible, photo-first intake experience.
- Direct access from a shared link.
- No registration or login requirement.
- AI-generated questions tailored to the initial photo.
- Adaptive follow-up questions based on the customer’s answers.
- Requests for additional photos when useful.
- A simple submission process.

Because customers may open links from mobile messaging apps, a mobile-friendly form is a sensible design requirement, although the excerpt does not discuss its visual design.

## AI and Differentiation

The defining feature is the connected workflow from **photo to adaptive questions to an automatically updated contractor portal**.

AI has three core roles:

1. **Visual analysis:** inspect the initial image and identify relevant visible details and information gaps.
2. **Adaptive questioning:** generate useful questions for that specific issue, then adjust follow-ups as the customer responds.
3. **Response synthesis and portal updates:** analyze all answers and images together, organize the information, and update the associated contractor request.

The result should help the technician understand the situation without manually reconstructing it from scattered messages. The portal should preserve original customer information, distinguish observed facts from possible explanations, and make uncertainty visible. If an image is unclear, the app should ask for clarification rather than invent details.

The specific AI provider, model, question count, and update timing are not yet selected.

## Suggested MVP Scope

The MVP should demonstrate one complete photo-first intake journey:

1. A contractor creates an intake request and gets a shareable link.
2. A customer opens the link without an account or download.
3. The customer takes or uploads a photo.
4. AI analyzes the photo and generates tailored questions.
5. The customer answers, with relevant adaptive follow-ups.
6. AI analyzes the complete intake and generates a structured service brief.
7. The contractor portal automatically updates the correct request with the summary, photos, answers, and unresolved details.
8. The contractor reviews the brief and its source material.

HVAC and plumbing are candidate initial use cases. The first version should focus on one trade so the questions and resulting brief can be evaluated against a concrete workflow.

Payments, scheduling, automated messaging, and a full field-service management platform are not confirmed MVP requirements.

## Expected Value

For customers, the intended value is a quick way to provide service information without extra setup.

For contractors, the proposed value is receiving useful information in a consistent format before handling a job. Better preparation, fewer clarification messages, and less administrative work are benefits to validate with actual service businesses.

The most clearly defined product principle is convenience: customers should participate through the communication channels and browser they already use.

## Decisions Still Open

- Which trade should the first version serve?
- Who inside the service business owns the intake process?
- What information is necessary before a visit?
- Which portal fields are essential for the first trade?
- Should portal updates appear progressively or after final submission?
- What should happen when a customer cannot provide a usable photo?
- What information is sufficient to stop asking questions?
- Which AI model and image-processing approach should power intake?
- Does the app need direct messaging integrations, or is manual link sharing sufficient?
- How will the team measure whether intake improves preparation or reduces administrative work?
- What is the pricing model?

## Short Product Description

A browser-based AI intake assistant for technicians and service businesses. Customers open a shared link, photograph the problem, and answer questions generated specifically from their photo and responses—without downloading an app or creating an account. AI analyzes the full intake and automatically updates the contractor portal with a structured service brief, supporting photos, customer answers, and details that still need confirmation.
