# Experiment Boilerplate

Built with [reactive-psych](https://github.com/adriansteffan/reactive-psych)

## Setup

## Deployment / Production

For deployment, you will need[docker](https://docs.docker.com/engine/install/)


To build the docker images, run 

```
docker compose build
```

in the root directory. This might take a while.

### Running the app

After completing the setup, start the webapp with

```
docker compose up -d
```

and stop it with

```
docker compose down
```

The server will be attached to the ports you specified in the .env files.
Use Virtualhosts (Apache) or Server Blocks (Nginx) with reverse proxy to expose these to the outside. [This guide](https://gist.github.com/adriansteffan/48c9bda7237a8a7fcc5bb6987c8e1790) explains how to do this for our setup.

### Updating

To update the app, simply stop the running containers, run a `git pull` and build the docker containers once more.

## Development

### Prerequisites

You will need a current version of [node.js](https://nodejs.org/en/download/) installed on your system.

### Frontend

#### Installation

From the root directory, run

```
npm i && npm i --prefix backend
```

#### Running

Run the app in the development mode with

```
npm run dev:all
```
in the root directory.

By default, open [http://localhost:5173](http://localhost:5173) to view it in the browser.
The page will reload if you make edits.

#### Buidling the frontend locally (to test)


From the `frontend` directory, run

```
npm run build
```

the resulting output can be found in `frontend/dist/`


### Backend

#### Installing

Run 

```
npm install
```

in the `backend` directory to install all needed dependencies.


#### Running the backend


TODO


## Authors

* **Adrian Steffan** - [adriansteffan](https://github.com/adriansteffan)