	$(document).ready(function () {

	    $('#nombre').focus();

            var gui = require('nw.gui');
            var win = gui.Window.get();
            var util = require('util');
            var fs = require('fs');

	    var Discover = require ("./lib/discover.js");
	    var discovery_port = 14002;
            var nodo_hello_interval = 1000;
            var nodo_check_interval = 2000;
            var nodo_timeout = 6000;
            var master_timeout = 8000;
	    var nodo;
           
            var server_child;
	    var local_ip;

	    var usuario_info = {};
            var IMG_CARPETA = 'img/';
            var IMG_NOMBRE = 'carta_';
            var IMG_EXTENSION = '.png';
            var FILE_LOGGER = '/tmp/log-servidor.txt';
            var RETARDO_MIN=1000;
            var RETARDO_MAX=6000;
            var off_click = 0; //evitar multiples clicks en la lista de amigos
	    var retiro = 0; //para que ante el retiro del oponente solo reiniciar el server una vez
	    var soyjugador2 = 0; //para identificarme como jugador2 y reiniciar si el server se desconecta

            function init_server(server_name) {
                var spawn = require('child_process').spawn;
                spawn = require('child_process').spawn;
                server_output = spawn('nodejs', ['../bin/server.js', "--usuario=" + server_name]);
                server_output.stdout.on('data', function (data) {
                    fs.appendFileSync(FILE_LOGGER, data + "\n");
                });
                return server_output;
            }

            function init() {
                local_ip = require('my-local-ip')();
                var socket = io("http://" + local_ip + ":3000/", {query: 'nro_jugador=jugador1&nombre_jugador=' + usuario_info.nombre});
                usuario_info.nro_jugador = 'jugador1';
                usuario_info.ip = local_ip;

                registrar_espera(socket);
                console.log('Inicie y me conecte al servidor');
            }

            function elegir_amigo(amigo_ip) {
                var socket = io("http://" + amigo_ip + ":3000/", {query: 'nro_jugador=jugador2&nombre_jugador=' + usuario_info.nombre, 'force new connection':true});
                usuario_info.nro_jugador = 'jugador2';
                usuario_info.ip = amigo_ip;

                registrar_espera(socket);
            };

            function registrar_espera(socket) {
                 socket.on('connect', function () {

                    socket.on('deslistar', function (ip) {
			nodo.stop();
			//pongo el server del jugador dos en estado ocupado
			var patron = '::ffff:';
			var format_ip = ip.replace(patron,'');
			if (local_ip == format_ip) {
	            		server_child.kill('SIGHUP');
				soyjugador2 = 1;
			}
		    });

		    socket.on('ocupado', function(ip) {
			var patron = '::ffff:';
			var format_ip = ip.replace(patron,'');
			//desconecto al ip que pidio peticion cuando estaba el server ocupado
			if (local_ip == format_ip) {
				console.log("Me desconecto del socket porque el server esta ocupado");
				socket.disconnect();
			        nodo.stop();

                        	$("#msg .alert-warning").find('div').html('<strong>Cuidado: </strong> El jugador ya inicio una partida con otro usuario.');
                        	$("#msg .alert-warning").show("slow");

				reiniciar_server();
                  	
                        	setTimeout(function () {
                        	    $("#msg .alert-warning").hide();
			            iniciar_discover(usuario_info.nombre);
	                            actualizar_amigos();
                        	}, RETARDO_MAX);
			}
		    });

                    socket.on('listo', function (o) {
			retiro = 0;
                        $("#amigos").hide();
                        $("#titulo").html('A Jugar!!!');
                        $(".avatar1 h3").html(o.jugador1.nombre);
                        $(".avatar2 h3").html(o.jugador2.nombre);
                   	$("#juego, #titulo").show();
                    });

                    socket.on('retiro', function (estado) {
			if ((estado == 0) && (retiro == 0)) {
				//este evento se produce cuando se retira solo el oponente y solo en la primera desconexion
				retiro++;
				console.log('Se desconecto el cliente'); 
                        	$("#juego, #volver, #titulo, #resultados").hide();
                        	$("#msg .alert-warning").find('div').html('<strong>Cuidado: </strong> Se perdio conexi&oacute;n con el cliente volviendo a la sala de amigos.');
                        	$("#msg .alert-warning").show("slow");

				reiniciar_server();

                        	setTimeout(function () {
                        	    $("#msg .alert-warning").hide();
		        	    iniciar_discover(usuario_info.nombre);
                        	    actualizar_amigos();
                        	    $("#amigos").show();
                        	}, RETARDO_MAX);
			}
                    });

		    socket.on('disconnect', function() {
			if (soyjugador2 == 1) {
				console.log('Se desconecto el server');
				socket.disconnect();
                        	$("#juego, #titulo, #resultados").hide();
                        	$("#msg .alert-warning").find('div').html('<strong>Cuidado: </strong> Se perdio conexi&oacute;n con el servidor volviendo a la sala de amigos.');
                        	$("#msg .alert-warning").show("slow");
				
				reiniciar_server();
				soyjugador2 = 0;
                        	setTimeout(function () {
                        	    $("#msg .alert-warning").hide();
		        	    iniciar_discover(usuario_info.nombre);
                        	    actualizar_amigos();
                        	    $("#amigos").show();
                        	}, RETARDO_MAX);
				
			}
		    });

                    socket.on('tabla', function (resultados) {

	                tabla = $('<div class="tabla"></div>');
			jugada=0;

                	$(tabla).append($('<div class="fila"> \
				<div class="num">#</div> \
                		<div class="j1">' + $(".avatar1 h3").html() + '</div> \
                 		<div class="j2">' + $(".avatar2 h3").html() + '</div> \
                    		<div class="res">Resultado</div> \
                    		<div class="clear"></div></div>'));
                        
                        resultados.forEach(function (element, index, array) {
                            if(element.respuestaCorrecta === element.jugador1.respuesta) {
                                fila = $('<div class="fila ok"></div>');
                            } else {
                                fila = $('<div class="fila danger"></div>');
                            }
                            jugada = index+1;
                            if(element.respuestaCorrecta === "empate") {
				$(fila).append($('<div class="num pad">' + jugada + '</div> \
                 		<div class="j1"><img src="' + IMG_CARPETA + IMG_NOMBRE + element.jugador1.carta.img + "_resultado" + IMG_EXTENSION + '" /></div> \
                 		<div class="j2"><img src="' + IMG_CARPETA + IMG_NOMBRE + element.jugador2.carta.img + "_resultado" + IMG_EXTENSION + '" /></div> \
                    		<div class="res pad">E</div> \
                    		<div class="clear"></div>'));
                            } else {
				$(fila).append($('<div class="num pad">' + jugada + '</div> \
                 		<div class="j1"><img src="' + IMG_CARPETA + IMG_NOMBRE + element.jugador1.carta.img + "_resultado" + IMG_EXTENSION + '" /></div> \
                 		<div class="j2"><img src="' + IMG_CARPETA + IMG_NOMBRE + element.jugador2.carta.img + "_resultado" + IMG_EXTENSION + '" /></div> \
                    		<div class="res"><img src="' + IMG_CARPETA + IMG_NOMBRE + element[element.respuestaCorrecta].carta.img + "_resultado" + IMG_EXTENSION + '" /></div> \
                    		<div class="clear"></div>'));
                            }
			    $(tabla).append($(fila));   
                         });
			$("#juego").hide();
                        $('#resultados').html(tabla);
                        $("#resultados").show();
                    });


		    socket.on('mano', function (o) {
                        console.log('Desde el server me llegan cartas:');
                        console.log(JSON.stringify(o, null, 2));
                        // Contador
                        if (o.jugador1.contador > 0) {
                            $(".avatar1 .contador img").prop('src', IMG_CARPETA + 'caja_cartas' + IMG_EXTENSION);
                        }
                        $(".avatar1 .contador span").html(o.jugador1.contador);
                        if (o.jugador2.contador > 0) {
                            $(".avatar2 .contador img").prop('src', IMG_CARPETA + 'caja_cartas' + IMG_EXTENSION);
                        }
                        $(".avatar2 .contador span").html(o.jugador2.contador);

                        // Cartas
                        $("#mano .jugador1").prop("src", IMG_CARPETA + IMG_NOMBRE + o.jugador1.carta.img + IMG_EXTENSION);
			$("#mano .jugador2").prop("src", IMG_CARPETA + IMG_NOMBRE + o.jugador2.carta.img + IMG_EXTENSION);


                        $("#mano .empate").prop("src", IMG_CARPETA + 'empate' + IMG_EXTENSION);
                        // Cuando hay Guerra
                        if (o.contadorGuerra) {
                            $("#mano .guerra span").html(o.contadorGuerra);
                            $("#mano .guerra").show();
                        } else {
                            $("#mano .guerra").hide();
                        }
                        $("#mano .respuesta").on('click', function (event) {
			    event.stopPropagation();
                            console.log('Se clickea carta');
                            console.log(JSON.stringify({jugador: usuario_info.nombre, respuesta: $(this).find('img').prop('class')}, null, 2));
                            // Deshabilita cartas
                            $("#mano .jugador1").prop("src", IMG_CARPETA + IMG_NOMBRE + o.jugador1.carta.img + '_deshabilitado' + IMG_EXTENSION);
                            $("#mano .jugador2").prop("src", IMG_CARPETA + IMG_NOMBRE + o.jugador2.carta.img + '_deshabilitado' + IMG_EXTENSION);
                            $("#mano .empate").prop("src", IMG_CARPETA + 'empate_deshabilitado' + IMG_EXTENSION);
                            $("#mano .respuesta").off('click');
                            socket.emit('respuesta', {nro_jugador: usuario_info.nro_jugador, ip: usuario_info.ip, nombre: usuario_info.nombre, respuesta: $(this).find('img').prop('class')});
                        });
                        $("#mano").show();
                    });

                  }); //fin socket.on connect
            }

            function actualizar_amigos() {
                e = $("<div></div>");
		nodo.eachNode ( function (node) {
                	tmp = '<div class="cada-amigo" data-ip="' + node.address + '"> \
				<div class="amigo-avatar"><a href="#"><img src="img/avatar-neutro.png" class="img-responsive" /></a></div> \
				<div class="amigo-nombre">' + node.advertisement + '</div> \
                		<div class="clear"></div> \
			</div>';
			$(e).append($(tmp).on('click', function (event) {
		                event.stopPropagation();
				$(this).off('click');
				//utilizo off_click para prevenir varios clicks en la lista de amigos
				if (off_click == 0) {
					off_click = 1;
					elegir_amigo($(this).data('ip'));
                        		setTimeout(function () {
						off_click = 0;
					}, RETARDO_MAX);
				}
			    }));
                } );
                $('#listado').html(e);
                $('#listado').show();
            }

            function set_usuario_info(nombre) {
                usuario_info['nombre'] = nombre;
                //Hago aparecer listado de amigos
                $("#avatar").hide();
                $("#amigos").show();
            }

	    function reiniciar_server() {
            	if (server_child) { 
    			console.log('Matando el server');
             		server_child.kill('SIGTERM');
 		}
	    	server_child = init_server(usuario_info.nombre);// Iniciar servidor

		setTimeout(function () {
                	init(); //Me conecto a mi propio server
                }, RETARDO_MIN);
	    }


            win.on('close', function () {
                console.log('Saliendo del cliente');
                if (server_child) { //Chequeo que se haya iniciado el server
                    server_child.kill('SIGTERM');
                }
                win.close(true);
                this.close(true);
            });

            $("#entrar").on("click", function (event) {
                event.stopPropagation();
                var nombre = $("#nombre").val();
                //valida nombre usuario
                if (!nombre) {
                    $("#msg .alert-danger").find('div').html('<strong>Error: </strong> Falta el nombre de usuario.');
                    $("#msg .alert-danger").show("slow");
            	    return false;
                } else {
                    $("#msg .alert-danger").hide();
                    set_usuario_info(nombre);
                    server_child = init_server(nombre); //Iniciar servidor
                    $("#amigos .caption").find("h3").html(nombre);
		    iniciar_discover(nombre);
                    setTimeout(function () {
                        init(); //Me conecto a mi propio server
                    }, RETARDO_MIN);
            	    return false;
                }
	    });

	    function iniciar_discover(user) {
          	    nodo = new Discover ({helloInterval : nodo_hello_interval, checkInterval : nodo_check_interval, nodeTimeout : nodo_timeout, masterTimeout : master_timeout, port : discovery_port, reuseAddr : false});
		    nodo.advertise(user);
           	    nodo.on("added", function () {actualizar_amigos()});
           	    nodo.on("removed", function () {actualizar_amigos()});
 	     	    nodo.on("master", function () {actualizar_amigos()});
	    }

            $("#cerrar").on("click", function () {
                win.close();
            });
        });
