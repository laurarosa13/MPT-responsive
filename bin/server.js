var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var local_ip = require('my-local-ip')()
var spawn = require('child_process').spawn;
var FILE_LOGGER = '/tmp/log-servidor.txt';

var PUERTO = 3000;
var jugadores = {};
var resultados = [];
var MAX_RESPUESTAS_DIFIRENTES = 0;
var contador_jugadores = 0;
var MAX_JUGADORES = 2;
var FILE_MAZO = '../src/mazo.json';
var Mazo = require(FILE_MAZO);
var estado = 0; //la utilizo en el jugador2 para poner su server como ocupado

function iniciar_servidor(PUERTO) {
	var indice = 0;
	var respuestaCorrecta = "";
	var respuestaAuxiliar = {};
	var ultimoGanador = ""; // Guarda este dato para cuando la última jugada es empate.

	io.on('connection', function (socket) {
		console.log('Se conecto un jugador'); 
 
		var jugador_ip = socket.handshake.address;
		var nombre_jugador = socket.handshake.query.nombre_jugador;

		contador_jugadores++;
		var aux = 'jugador'+contador_jugadores;
		jugadores[aux] = { nombre: nombre_jugador, ip: jugador_ip, contador: 0, mazo: [] };

		if ((contador_jugadores > MAX_JUGADORES) || (estado == 1)) {
			//le envio mensaje de ocupado para desconectarlo del socket
			io.emit('ocupado',jugador_ip);
		} else {

			if (cantidad(jugadores) == MAX_JUGADORES) {
				console.log('Detenemos el discover de ambos jugadores');
				io.emit('deslistar', jugadores.jugador2.ip);
				jugadores.contadorGuerra = 0;
				repartir_cartas(jugadores);
				io.emit('listo', get_jugadores(jugadores));
				console.log('Se juega ahora la mano: ' + indice);
				io.emit('mano', get_mano(jugadores, indice));
			}
		}
		socket.on('disconnect', function () {
			console.log('Se desconecto un jugador');
			contador_jugadores--;
			if (socket.handshake.address == jugadores.jugador2.ip) {
				delete jugadores['jugador2'];
				io.emit('retiro',estado);
				resultados = [];
				jugadores = {};
			} else {
				delete jugadores['jugador3'];
			}
		});


		socket.on('respuesta', function (opcion) {
			respuestaAuxiliar[opcion.nro_jugador] = {respuesta: opcion.respuesta, carta: jugadores[opcion.nro_jugador].mazo[indice] };
			// Tengo ambas respuestas //
			if(respuestaAuxiliar.jugador1 && respuestaAuxiliar.jugador2) {
				console.log("Tengo ambas respuestas");
				respuestaCorrecta = "";
				if (jugadores.jugador1.mazo[indice].lados > jugadores.jugador2.mazo[indice].lados) {
					respuestaCorrecta = "jugador1";
				} else if (jugadores.jugador1.mazo[indice].lados < jugadores.jugador2.mazo[indice].lados) {
				respuestaCorrecta = "jugador2";
			} else {
			respuestaCorrecta = "empate";
			}
			respuestaAuxiliar.respuestaCorrecta = respuestaCorrecta;
			resultados[indice] = respuestaAuxiliar;
                
			// Respuestas iguales //
			if(resultados[indice].jugador1.respuesta == resultados[indice].jugador2.respuesta) {
				console.log('Respuestas iguales.');
				// Empate = Guerra //
				if(resultados[indice].jugador1.respuesta == 'empate') {
					console.log('Empate = Guerra.');
					add_contador_guerra();
				} else {
					console.log('Respuestas iguales. Ganó jugador: ' + resultados[indice].jugador1.respuesta);
					add_contador_jugador(resultados[indice].jugador1.respuesta); // Envia jugador1 porque es inditinto ya que eligieron la misma respuesta //
					ultimoGanador = resultados[indice].jugador1.respuesta;
				}
				indice++;
			} else {
			console.log('Las respuestas difieren Repregunto');
			}
			respuestaAuxiliar = {};
			console.log('Se juega ahora la mano: ' + indice);
                
			if(indice >= Mazo.mazo.length) {
				console.log("Mostrar la tabla de resultados.");
				if(exist_guerra()) {
					jugadores[ultimoGanador].contador += jugadores.contadorGuerra;
					jugadores.contadorGuerra = 0;
				}
			io.emit('tabla', resultados);
			return;
			}
			io.emit('mano', get_mano(jugadores, indice));
			}
		});

	}); //fin io.conecction

	http.listen(PUERTO, function () {
		console.log('Esperando jugadores en ' + PUERTO);
	});
}

function cantidad(arreglo) {
	return Object.keys(arreglo).length;
}

function get_jugadores(jugadores) {
	return { jugador1: { nro_jugador: 'jugador1', nombre: jugadores.jugador1.nombre, ip: jugadores.jugador1.ip, contador: jugadores.jugador1.contador }, jugador2: { nro_jugador: 'jugador2', nombre: jugadores.jugador2.nombre, ip: jugadores.jugador2.ip, contador: jugadores.jugador2.contador },
	};
}

function get_mano(jugadores, indice) {
    return {
        jugador1: { nro_jugador: 'jugador1', carta: jugadores.jugador1.mazo[indice], contador: jugadores.jugador1.contador },
        jugador2: { nro_jugador: 'jugador2', carta: jugadores.jugador2.mazo[indice], contador: jugadores.jugador2.contador },
        contadorGuerra: jugadores.contadorGuerra
    }
}

function add_contador_guerra() {
    jugadores.contadorGuerra++;
}

function exist_guerra() {
    return jugadores.contadorGuerra ? true : false;
}

function add_contador_jugador(jugador) {
    if(exist_guerra()) {
        console.log('Habia ' + jugadores.contadorGuerra + ' retenidas por guerra.');
        jugadores[jugador].contador += jugadores.contadorGuerra;
        jugadores.contadorGuerra = 0;
    }
    jugadores[jugador].contador++;
}


function repartir_cartas(jugadores) {
	mazo_completo = Mazo.mazo.concat(Mazo.mazo);
	mazo_jugador1 = [];
	mazo_jugador2 = [];

	for (var k = 0; k < Mazo.mazo.length; k++) {
		var id_carta_jugador1 = Math.floor(Math.random() * mazo_completo.length);
		var carta_jugador1 = mazo_completo[id_carta_jugador1];
		mazo_jugador1.push(carta_jugador1);
		mazo_completo.splice(id_carta_jugador1, 1);

		var id_carta_jugador2 = Math.floor(Math.random() * mazo_completo.length);
		var carta_jugador2 = mazo_completo[id_carta_jugador2];
		mazo_jugador2.push(carta_jugador2);
		mazo_completo.splice(id_carta_jugador2, 1);
	}
	jugadores.jugador1.mazo = mazo_jugador1;
	jugadores.jugador2.mazo = mazo_jugador2;
}

var usuario;
process.argv.forEach(function (val, index, array) {
	if (/--usuario=/.test(val)) { usuario = val.split('=')[1]; }
});

process.on('SIGHUP', function() {
	console.log('Pongo el server del jugador 2 como ocupado');
	estado = 1;
});

process.on('SIGTERM', function() {
	console.log('Saliendo...');
	process.exit(0);
});

iniciar_servidor(PUERTO);
