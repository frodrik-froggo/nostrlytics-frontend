# Nostrlytics frontend

This is an experimental project to create a simple analytics library that can be used to track user interactions on a website without exposing the data to any one third party.

### Why?
Some people writing blogs or running small websites might not want to use Google Analytics or other third party analytics services or are unable or don't want to run their own infrastructure. This project aims to provide a simple way to track user interactions on a website without exposing the data to any third party.

### How?
All interaction events are sent to nostr relay in encrypted form. The only one who can analyze the data is the website owner who has access to the encryption key. The data included in the events is minimal and does not include any personal information.
It contains:
- event type (impression or click out)
- timestamp
- page url the event occurred on
- language of the browser
- user agent
- referrer (in case of page impressions event)
- click out url (in case of a click out event)

### How to use?

1. Edit the nostrlyticsConfig inside dist/index.html.
```html
<script>
  document.nostrlyticsConfig ={
    relays: [
      'wss://relay.damus.io',
      'wss://relay.snort.social'
        ...more relays...
    ]
  }
</script>
```
2. Upload the nostrlytics scripts in `assets` to your website.

3. Checkout https://github.com/frodrik-froggo/nostrlytics for a script which will collect user interaction on your website.

### Acknowledgements:

* project is based on vite react typescript template at https://github.com/doinel1a/vite-react-ts-starter
