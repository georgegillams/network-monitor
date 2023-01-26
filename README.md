# network-monitor

A simple server application which can be run on a raspberry pi to monitor network up/down status.

# Local development

- Install dependencies using `yarn`.
- Run the server using `yarn start`.
- Visit http://192.168.0.95:8080/logs

# Deployment

- Run yarn
- Configure the Pi to run `yarn start` on boot using PM2, crontab, or similar.
