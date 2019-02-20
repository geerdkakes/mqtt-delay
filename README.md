# mqtt-delay

This app can be used to test the delay to a mqtt server with different payload sizes and timing intervals. The app can be build into a container or run from the command line.

## Run from command line

Make sure you have npm and node installed on your system.

Install packages using: 
```
npm install
```

run the app with:
```
node server.js -i 500 -b 20 -q 2 -u user -s passwd -h localhost
```
the flags stand for:
 * -i wait_time_in_msec
 * -h hostname (if ommited localhost is used)
 * -p port (if ommited port 1883 is used)
 * -b number_of_bytes_send (10 if ommitted)
 * -q qos_option (0 if ommitted)
 * -u user
 * -s passwd
 * -o output file to write output to (if ommited stdout is used)
 * -l location file where gps location is stored (if ommited location.value is used)
 * -c cellid file where cellid is stored (if ommited cellid.value is used)


## Optional using docker

Build docker image
```
docker build -t mqtt-delay .
```

Run the docker image using:
```
docker run -it mqtt-delay -i 500 -b 20 -q 2 -u user -s passwd -h localhost
```


