# network-monitor

A simple server application which can be run on a raspberry pi to monitor network up/down status.

## Local development

- Install dependencies using `yarn`.
- Run the server using `yarn start`.
- Visit http://localhost:8080/logs

## Deployment

- Run yarn
- Configure the Pi to run `yarn start` on boot using PM2, crontab, or similar.

## Specify chromium executable path

If you want to specify the chromium executable path, use the `--executable-path` argument. eg

```bash
yarn start --executable-path "/usr/bin/chromium-browser"
```

## Environment variables

| Variable           | Description                                                              | Default |
| ------------------ | ------------------------------------------------------------------------ | ------- |
| PORT               | The port the server will listen on                                       | 8080    |
| WEBHOOK_ENDPOINT   | The endpoint to send POST requests to when the network status changes    |         |
| WEBHOOK_ACCESS_KEY | The access-key to use when sending POST requests to the webhook endpoint |         |
