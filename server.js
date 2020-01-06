var mqtt=require('mqtt');
const args = require('minimist')(process.argv.slice(2));
var nodeCleanup = require('node-cleanup');
const fs = require('fs');
var secure = false;
var port;
var testNumLimite;
var testNum = 0;
var KEY = __dirname + '/client_key.pem';
var CERT = __dirname + '/client_certificate.pem';
var CA = __dirname + '/ca_certificate.pem';

/*
 * -i wait_time_in_msec
 * -h url (if ommited mqtt://localhost is used)
 * -p port (if ommited port 1883 is used)
 * -b number_of_bytes_send (10 if ommitted)
 * -q qos_option (0 if ommitted)
 * -u user
 * -s passwd
 * -o output logfile name to write to
 * -n number of tests
 * 
 * When using TLS make sure the CA certificate is known. E.g. by
 * specifying the path wit an environment variable:
 * 
 * export NODE_EXTRA_CA_CERTS=/Users/geerd/Developer/geoserver-k8s/etc/ca_certificate.pem
 * 
 */

 // when running on the cluster with rabbitmq use "rabbitmq.default.svc.appfactory.local"
 // for the hostname

var mqtt_url = (typeof args.h === 'undefined' || args.h === null) ? "mqtt://localhost" : args.h;

if (mqtt_url.substring(0,5) === "mqtts") {
   secure = true;
}
if (typeof args.p === 'undefined' || args.p === null) {
    // no port specified, we guess the port
    if (secure) {
        port = 8883;
    } else {
        port = 1883;
    }
} else {
    port = args.p;
}

testNumLimite = args.n;

var mqtt_options = {
    clientId: "mqttjs03",
    username: (typeof args.u === 'undefined' || args.u === null) ? "testuser" : args.u,
    password: (typeof args.s === 'undefined' || args.s === null) ? "passwd" : args.s,
    port: port,
    clean: false,
    rejectUnauthorized : true,
//    passphrase: '1j38dh2sf',
    //The CA list will be used to determine if server is authorized
//    ca: TRUSTED_CA_LIST
};

if (secure) {
    mqtt_options.key = fs.readFileSync(KEY);
    mqtt_options.cert = fs.readFileSync(CERT);
    mqtt_options.ca = fs.readFileSync(CA);
}

console.log("mqtt_options:");
console.log(mqtt_options);

var message_options = {
    retain:false,
    qos:(typeof args.q === 'undefined' || args.q === null) ? 0 : args.q
};

var file_log = (typeof args.o === 'undefined' || args.o === null) ? null : args.o;

var topic="testtimingtopic";
var number_of_bytes_send = (typeof args.b === 'undefined' || args.b === null) ? 10 : args.b;
const message_buffer = Buffer.alloc(number_of_bytes_send, 1); // buffer filled with ones
var sendtime = 999; // arbitrary number other than 0 to start only with sending after subscribing
var connected = false;
var interval = (typeof args.i === 'undefined' || args.i === null) ? 500 : args.i; // millisecond
var timing_values = [];
var client  = mqtt.connect(mqtt_url,
                           mqtt_options
                           );

var fd_log = null;

// open log file
if (file_log) {
    fs.open(file_log, 'a', function postOpen(errOpen, fd) {
        if (errOpen) {
            console.error("could not open file: " + file_log + " for writing");
            process.exit(1);
        }
        fd_log = fd;
    });
} else {
    // set to stdout
    fd_log = 1;
}

client.on("connect",function(){	
    connected = client.connected;
    client.subscribe(topic, function (err) {
        if (!err) {
          console.log("subscribed to topic " + topic);
          sendtime = 0; // enable sending
        } else console.log( "error subscribing:" + err );
    });
});

client.on("error", function(error){ 
   console.log("Can't connect"+error);
   process.exit(1);
});

//handle incoming messages
client.on('message',function(topic, message, packet){
    // console.log("incomming message with sendtime: " + sendtime + " and message: " + message);
    if (sendtime != 0) {
        fs.write(fd_log, Date.now().valueOf() + "|" + process.hrtime(sendtime)[1]/1000000 + "\n",function postWrite(errWrite, written, string){
            if (errWrite) {
                console.error("Error writing log data");
            }
        });
        timing_values.push(process.hrtime(sendtime)[1]);
        sendtime = 0;
        if (testNumLimite && testNum >= Number(testNumLimite)) {
            // We have reached the amount of tests (specified with -n option)
            process.exit(0);
        }
    }
});

 
setInterval(function(){
    // console.log("interval called with connected: " + connected + " sendtime:" + sendtime);
    if ( connected == true && sendtime == 0) {
        sendtime = process.hrtime();
        client.publish(topic, message_buffer, message_options);
        testNum++;
    } else {
        if (connected == false) {
            console.log("no connection...");
        } else {
            console.log("skipping...");
        }
    }
}, interval);

var average = function(elmt) {
    var sum = 0;
    for( var i = 0; i < elmt.length; i++ ){
        sum += parseInt( elmt[i], 10 ); //don't forget to add the base
    }

    var avg = sum/elmt.length;
    return avg;
}

nodeCleanup(function (exitCode, signal) {
    min_value = Math.min.apply(null, timing_values);
    max_value = Math.max.apply(null, timing_values);
    avg_value = average(timing_values);
    console.log("");
    console.log("min, avg, max (msec): " + min_value/1000000 + ", " + avg_value/1000000 + ", " + max_value/1000000);
    if (fd_log != null && fd_log != 1) {
        fs.closeSync(fd_log);
    }
});
