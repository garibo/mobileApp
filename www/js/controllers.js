angular.module('starter.controllers', ['ngCordova', 'ui.router'])

.controller('AppCtrl', function($scope, $localstorage, $ionicPopup, $state) {
  $scope.$on('$ionicView.enter', function(){
    $localstorage.get('email') || $state.go('login'); 
    $scope.nombre = $localstorage.get('nombre');
    $scope.email = $localstorage.get('email');
    $scope.imagen = $localstorage.get('imagen');
    if (window.StatusBar) {
      StatusBar.backgroundColorByHexString("#263238");
    }
  });

  $scope.salir = function(){
    var confirmPopup = $ionicPopup.confirm({
      title: '¿Deseas salir de la aplicación?',
      cancelText: 'Cancelar',
      okText: 'Si'
    });
    confirmPopup.then(function(res){
      if(res) {
        $localstorage.set('email', '');
        $state.go('login');
      }
    });
  };
})

.controller('pedidosCtrl', function($scope, $ionicLoading, $localstorage, $cordovaNetwork, $cordovaToast, $state, ListaPedidos) {

  $scope.$on('$ionicView.enter', function(){
   $localstorage.get('email') || $state.go('login'); 
  });

  $ionicLoading.show({
    content: 'Loading',
    animation: 'fade-in',
    showBackdrop: true,
    maxWidth: 200,
    showDelay: 0
  });

  if($cordovaNetwork.isOffline()){
    $ionicLoading.hide();
    $scope.pedidos = {};
    $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
  }
  else{
    ListaPedidos.datos($localstorage.get('id'))
    .then(function(data) {
      $scope.pedidos = data;
      $ionicLoading.hide();
    },
    function(error) {
      $ionicLoading.hide();
      $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
    });
  }


  $scope.fecha = function(dia) {
    moment.locale('es');
    return moment(dia).format('MMMM Do YYYY');
  }

  $scope.total = function(data) {
    var finalt = 0;
    for (var i = 0; i < data.length; i++) {
      finalt += data[i].precio != null ? parseFloat(data[i].precio)  : 0;
      finalt += data[i].precio_pizza != null ? parseFloat(data[i].precio_pizza) : 0;
    };      
    return finalt;
  }

  $scope.refrescar = function() {
    if($cordovaNetwork.isOffline()) {
      $scope.$broadcast('scroll.refreshComplete');
      $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
    }
    else {
      ListaPedidos.datos($localstorage.get('id'))
      .then(function(data) {
        $scope.pedidos = data;
        $scope.$broadcast('scroll.refreshComplete');
      },
      function(error) {
        $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
      });     
    }
  };

})


.controller('canastaCtrl', function($scope, $state, $cordovaSQLite, $ionicPopup, $ionicModal, $cordovaGeolocation, $ionicLoading, $localstorage, $cordovaNetwork, $cordovaToast, Pedidos) {

  $scope.productos = [];
  $scope.total = 0;

  $scope.$on('$ionicView.enter', function(){
    $localstorage.get('email') || $state.go('login'); 
    var db = $cordovaSQLite.openDB("yesApp.db");
    var query = "SELECT * FROM canasta ORDER BY id DESC";
    $cordovaSQLite.execute(db, query, [])
    .then(function(res){
      if(res.rows.length > 0) {
      for (var i = 0; i < res.rows.length; i++) {
        $scope.productos.push(res.rows.item(i));
        $scope.total += res.rows.item(i).precio;
        };
      } else {}
    }, function (err) {
     alert(err);
    }); 
  });

  $scope.$on('$ionicView.leave', function(){
    $scope.productos = [];
    $scope.total = 0;
  });

  $scope.eliminar = function(producto){
    var db = $cordovaSQLite.openDB("yesApp.db");
    var query = "DELETE FROM canasta WHERE id = ?";
    var confirmPopup = $ionicPopup.confirm({
      title: producto.nombre,
      template: 'Estas seguro que deseas eliminarlo de la lista?',
      cancelText: 'Cancelar',
      okText: 'Eliminar'
    });
    confirmPopup.then(function(res) {
    if(res){
      $cordovaSQLite.execute(db, query, [producto.id])
      .then(function(res){
        for(var i=0,len=$scope.productos.length;i<len;i++) {
          if($scope.productos[i].id == producto.id) {
            $scope.productos.splice(i,1);
            $scope.total -= producto.precio;
            break;
          }
        }
      }, function (err) {
       alert(err);
      }); 
    } else {
      console.log('You are not sure');
    }
    });
  }

  $scope.pedirData = {};

  $ionicModal.fromTemplateUrl('templates/direccion.html', {
   scope: $scope
  }).then(function(modal) {
   $scope.modal = modal;
  });

  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  $scope.login = function() {
   $scope.modal.show();
  };

  $scope.doLogin = function() {

  $ionicLoading.show({
    content: 'Loading',
    animation: 'fade-in',
    showBackdrop: true,
    maxWidth: 200,
    showDelay: 0
  });

  var posOptions = {timeout: 10000, enableHighAccuracy: false};
  $cordovaGeolocation
  .getCurrentPosition(posOptions)
  .then(function (position) {

  if($cordovaNetwork.isOffline()) {
    $ionicLoading.hide();
    $cordovaToast.show('Error revisa tu conexion a internet', 'long', 'bottom');
  }
  else {
      Pedidos.nuevoPedido($localstorage.get('id'), $scope.productos, position.coords.latitude, position.coords.longitude, $scope.pedirData, $scope.pedirData.telefono)
      .then(function(data) {
      if (data.respuesta === 'bien') {
        var conf = 'Y llegara a esta dirección: '+$scope.pedirData.calle+', #'+$scope.pedirData.numero+' '+$scope.pedirData.colonia+', \n En un momento recibira una confirmacion a este correo: '+$localstorage.get('email');
        $ionicLoading.hide();
        $scope.modal.hide();
        $scope.pedirData = {};
        $cordovaSQLite.execute($cordovaSQLite.openDB("yesApp.db"), "DELETE FROM canasta", []);
        $scope.productos = {};
        $scope.total = 0;
        var alertPopup = $ionicPopup.alert({
          title: 'Tu pedido ha sido enviado',
          template: conf
        });
      } else {
        $ionicLoading.hide();
        $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
      }
      }, function(error) {
        $ionicLoading.hide();
        $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
      });
  }

  }, function(err) {
    $ionicLoading.hide();
    $cordovaToast.show('Error al intentar obtener tu posicion, enciende el GPS', 'long', 'bottom');
  });
  };

})

.controller('productosCtrl', function($scope, $localstorage, $state, $ionicLoading, $ionicPopup, $filter, $cordovaSQLite, Precios, $cordovaNetwork, $cordovaToast, Pizzas, Platillos, Bebidas) {

  $scope.$on('$ionicView.enter', function(){
    $localstorage.get('email') || $state.go('login'); 
    $scope.citems = 0;
    var db = $cordovaSQLite.openDB("yesApp.db");
    var query = "SELECT * FROM canasta";
    $cordovaSQLite.execute(db, query, [])
    .then(function(res){
      if(res.rows.length > 0) {
        $scope.citems = res.rows.length;
      } else {}
    }, function (err) {
     alert(err);
    }); 
  });

  $ionicLoading.show({
    content: 'Loading',
    animation: 'fade-in',
    showBackdrop: true,
    maxWidth: 200,
    showDelay: 0
  });

  if($cordovaNetwork.isOffline())
  {
    $ionicLoading.hide();
    $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
  }
  else
  {
    $scope.pizzas = Pizzas.query(function(){
      $ionicLoading.hide();
      $scope.precios = Precios.query();
    },function(){
      $ionicLoading.hide();
      $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
    });
    $scope.platillos = Platillos.query();
    $scope.bebidas = Bebidas.query();
  }

 $scope.refrescar = function() {
    if($cordovaNetwork.isOffline())
    {
      $scope.$broadcast('scroll.refreshComplete');
      $cordovaToast.show('Error revisa tu conexion a internet', 'long', 'bottom');
    }
    else
    {
      $scope.pizzas = Pizzas.query(function(){
          $ionicLoading.hide();
          $scope.precios = Precios.query();
          $scope.$broadcast('scroll.refreshComplete');
        },function(){
          $ionicLoading.hide();
          $cordovaToast.show('Error de servidor intentalo mas tarde', 'long', 'bottom');
        });
        $scope.platillos = Platillos.query();
        $scope.bebidas = Bebidas.query();    
      }
  };

   $scope.agregarPlatillo = function(platillo) {
     var confirmPopup = $ionicPopup.confirm({
       title: 'Deseas ordenar este platillo?',
       template: '<p>'+platillo.nombre+'</p><p><strong>'+$filter('currency')(platillo.precio)+'</strong></p>',
       cancelText: 'Cancelar',
       okText: 'Ordenar'
     });
     confirmPopup.then(function(res) {
       if(res) {
         insertar(platillo.id, platillo.nombre, platillo.precio, platillo.ingredientes, null, platillo.imagen_url);
       } else {
         console.log('You are not sure');
       }
     });
   }

  $scope.agregarBebida = function(bebida) {
    var confirmPopup = $ionicPopup.confirm({
      title: 'Deseas ordenar esta bebida?',
      template: '<p>'+bebida.nombre+'</p><p><strong>'+$filter('currency')(bebida.precio)+'</strong></p>',
      cancelText: 'Cancelar',
      okText: 'Ordenar'
    });
    confirmPopup.then(function(res) { 
      if(res) {
        insertar(bebida.id, bebida.nombre, bebida.precio, bebida.ingredientes, null, bebida.imagen_url);
      } else {
        console.log('You are not sure');
      }
    });
  }

  $scope.agregarPizza = function(pizza) {
    $scope.data = {}

    var myPopup = $ionicPopup.show({
      templateUrl : 'templates/precios.html',
      title: 'Escoja el tamaño de su Pizza',
      subTitle: ''+pizza.nombre,
      scope: $scope,
      buttons: [
        { text: 'Cancelar' },
        {
          text: '<b>Ordenar</b>',
          type: 'button-positive',
          onTap: function(e) {
            if (!$scope.data.precio) {
              e.preventDefault();
            } else {
              return $scope.data.precio;
            }
          }
        }
      ]
    });
    myPopup.then(function(res) {
      if(res) {
        for(var i = 0; i < $scope.precios.length; i++)
        {
          if($scope.precios[i].precio == res)
          {
            insertar(pizza.id, pizza.nombre, res, pizza.ingredientes, $scope.precios[i].id, pizza.imagen_url);
            break;
          } 
        }
       } else {
         console.log('You are not sure');
       }
    });
 }

  function insertar(id, nombre, precio, ingredientes, tamano, imagen) {
    if($scope.citems >= 8){
      $cordovaToast.show('Error solo puede ordenar un maximo de 8 productos', 'long', 'bottom');
    }else{
        var db = $cordovaSQLite.openDB("yesApp.db");
      var query = 'INSERT INTO canasta  (id_producto, nombre, precio, ingredientes, tamano, imagen_url) VALUES (?, ?, ?, ?, ?, ?)';
      $cordovaSQLite.execute(db, query, [id, nombre, precio, ingredientes, tamano, imagen]).then(function(res) {
        $scope.citems++;
        $state.go('app.canasta'); 
      }, function (err) {
        alert(JSON.stringify(err));
      });   
    }
  }

})

.controller('ajustesCtrl', function($scope, $localstorage, $cordovaOauth, $cordovaNetwork, $cordovaToast, $http, $state, $ionicPopup, Usuarios) {

  $scope.$on('$ionicView.enter', function(){
    $localstorage.get('email') || $state.go('login');  
    $scope.nombre = $localstorage.get('nombre');
    $scope.email = $localstorage.get('email');
    $scope.imagen = $localstorage.get('imagen');
    $scope.genero = $localstorage.get('genero');
    "male"==$scope.genero&&($scope.sexo="Masculino");
    "female"==$scope.genero&&($scope.sexo="Femenino");
  }); 


  $scope.salir = function(){
    var confirmPopup = $ionicPopup.confirm({
        title: '¿Deseas salir de la aplicación?',
        cancelText: 'Cancelar',
        okText: 'Si'
    });
    confirmPopup.then(function(res) {
      if(res) {
        $localstorage.set('email', '');
        $state.go('login');
      }
    });
  };

  $scope.googleLogin = function(){
    if($cordovaNetwork.isOffline()){
      $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
    }
    else{
      $cordovaOauth.google("956498525722-bd18h7c72rpqutl22d6oqug36j3cq4ue.apps.googleusercontent.com", ["https://www.googleapis.com/auth/urlshortener", "https://www.googleapis.com/auth/userinfo.email"]).then(function(result) {
        alert(JSON.stringify(result));
        $scope.getUserGoogle(result.access_token);
      }, function(error) {
        $cordovaToast.show('Imposible conectar, intentalo mas tarde', 'long', 'bottom');
      });
    }
  }

  $scope.getUserGoogle = function(accessToken){
    $http.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token='+accessToken)
    .then(function(result) {
        $localstorage.set('nombre', result.data.name);
        $localstorage.set('email', result.data.email);
        $localstorage.set('imagen', result.data.picture);
        $localstorage.set('genero', result.data.gender);
        getUserData(result.data.name, result.data.email);
        alert(JSON.stringify(result.data));
        $state.go('app.pizzas');
    }, function(error){

    });
  };

  $scope.facebookLogin = function() {
    if($cordovaNetwork.isOffline()){
      $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
    }
    else{
      $cordovaOauth.facebook("709455109197894", ["email", "public_profile", "user_friends"]).then(function(result) {
         $scope.accessToken = result.access_token;
         $scope.getUserFacebook($scope.accessToken);
      }, function(error) {
         $cordovaToast.show('Imposible conectar, intentalo mas tarde', 'long', 'bottom');
      });
    }
  };


  $scope.getUserFacebook = function(accessToken) {
    $http.get("https://graph.facebook.com/v2.2/me", { params: { access_token: accessToken, fields: "id,name,gender,location,website,picture,relationship_status, email", format: "json" }}).then(function(result) {
        alert(JSON.stringify(result.data));
        $localstorage.set('nombre', result.data.name);
        $localstorage.set('email', result.data.email);
        $localstorage.set('genero', result.data.gender);
        $localstorage.set('imagen', result.data.picture.data.url);
        getUserData(result.data.name, result.data.email);
        $state.go('app.pizzas');
    }, function(error) {
        alert("There was a problem getting your profile.  Check the logs for details.");
        console.log(error);
    });
  }

  function getUserData(nombre, correo)
  {
    Usuarios.nuevoUsuario(nombre, correo)
    .then(function(data) {
      alert(data.id);
      $localstorage.set('id', data.id);
    }, function(error) {
    });
  }

})

.controller('loginCtrl', function($scope, $cordovaOauth, $localstorage, $location, $http, $state, $cordovaNetwork, $cordovaToast, Usuarios) {
   
  $scope.googleLogin = function(){
    if($cordovaNetwork.isOffline()){
      $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
    }
    else{
      $cordovaOauth.google("956498525722-bd18h7c72rpqutl22d6oqug36j3cq4ue.apps.googleusercontent.com", ["https://www.googleapis.com/auth/urlshortener", "https://www.googleapis.com/auth/userinfo.email"]).then(function(result) {
          alert(JSON.stringify(result));
          $scope.getUserGoogle(result.access_token);
      }, function(error) {
          $cordovaToast.show('Imposible conectar, intentalo mas tarde', 'long', 'bottom');
      });
    }
  }

  $scope.getUserGoogle = function(accessToken){
    $http.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token='+accessToken)
    .then(function(result) {
        $localstorage.set('nombre', result.data.name);
        $localstorage.set('email', result.data.email);
        $localstorage.set('imagen', result.data.picture);
        $localstorage.set('genero', result.data.gender);
        getUserData(result.data.name, result.data.email);
        alert(JSON.stringify(result.data));
        $state.go('app.pizzas');
    }, function(error){

    });
  };

  $scope.facebookLogin = function(){
    if($cordovaNetwork.isOffline()){
      $cordovaToast.show('Revisa tu conexion a internet', 'long', 'bottom');
    }
    else{
      $cordovaOauth.facebook("709455109197894", ["email", "public_profile", "user_friends"]).then(function(result) {
        $scope.accessToken = result.access_token;
        $scope.getUserFacebook($scope.accessToken);
      }, function(error) {
        $cordovaToast.show('Imposible conectar, intentalo mas tarde', 'long', 'bottom');
      });
    }
  };


  $scope.getUserFacebook = function(accessToken) {
    $http.get("https://graph.facebook.com/v2.2/me", { params: { access_token: accessToken, fields: "id,name,gender,location,website,picture,relationship_status, email", format: "json" }}).then(function(result) {
        alert(JSON.stringify(result.data));
        $localstorage.set('nombre', result.data.name);
        $localstorage.set('email', result.data.email);
        $localstorage.set('genero', result.data.gender);
        $localstorage.set('imagen', result.data.picture.data.url);
        getUserData(result.data.name, result.data.email);
        $state.go('app.pizzas');
    }, function(error) {
        alert("There was a problem getting your profile.  Check the logs for details.");
        console.log(error);
    });
  }

  function getUserData(nombre, correo)
  {
    Usuarios.nuevoUsuario(nombre, correo)
    .then(function(data) {
      alert(data.id);
      $localstorage.set('id', data.id);
    }, function(error) {

    });
  }
});