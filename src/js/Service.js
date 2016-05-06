var NGI = {
	Utils: require('./Utils')
};

var CLASS_DIRECTIVE_REGEXP = /(([\d\w\-_]+)(?:\:([^;]+))?;?)/;

function Service(app, module, invoke) {
	this.provider = invoke[0];
	this.type = invoke[1];
	this.definition = invoke[2];
	this.name = (typeof this.definition[0] === typeof '') ? this.definition[0] : null;
	this.factory = this.definition[1];

	switch(this.provider) {
		case '$compileProvider':

			var dir;

			try {
			  if (this.type === "component") {
			    var options = this.factory;
			    var controller = options.controller || function() {};

			    this.factory = function($injector) {
			      function makeInjectable(fn) {
			        if (angular.isFunction(fn) || angular.isArray(fn)) {
			          return function(tElement, tAttrs) {
			            return app.$injector.invoke(fn, this, {
			              $element: tElement,
			              $attrs: tAttrs
			            });
			          };
			        } else {
			          return fn;
			        }
			      }

			      var template = (!options.template && !options.templateUrl ? '' : options.template);
			      var ddo = {
			        controller: controller,
			        controllerAs: options.controllerAs || '$ctrl',
			        template: makeInjectable(template),
			        templateUrl: makeInjectable(options.templateUrl),
			        transclude: options.transclude,
			        scope: {},
			        bindToController: options.bindings || {},
			        restrict: 'E',
			        require: options.require
			      };

			      // Copy annotations (starting with $) over to the DDO
			      angular.forEach(options, function (val, key) {
			        if (key.charAt(0) === '$') ddo[key] = val;
			      });

			      return ddo;
			    }

			    this.factory.$inject = ['$injector'];
			  }

			  dir = app.$injector.invoke(this.factory);
			} catch (err) {
			  return console.warn(
			    'ng-inspector: An error occurred attempting to invoke directive: ' +
			    (this.name || '(unknown)'),
			    err
			  );
			}

			if (!dir) dir = {};
			var restrict = dir.restrict || 'AE';
			var name = this.name;

			app.registerProbe(function(node, scope, isIsolate) {

				if (node === document) {
					node = document.getElementsByTagName('html')[0];
				}

				// Test for Attribute Comment directives (with replace:true for the
				// latter)
				if (restrict.indexOf('A') > -1 ||
					(dir.replace === true && restrict.indexOf('M') > -1)) {
					for (var i = 0; i < node.attributes.length; i++) {
						var normalized = NGI.Utils.directiveNormalize(node.attributes[i].name);
						if (normalized === name) {
							if (!isIsolate && dir.scope === true ||
								isIsolate && typeof dir.scope === typeof {}) {
								scope.view.addAnnotation(name, Service.DIR);
							}
						}
					}
				}

				// Test for Element directives
				if (restrict.indexOf('E') > -1) {
					var normalized = NGI.Utils.directiveNormalize(node.tagName.toLowerCase());
					if (normalized === name) {
						if (!isIsolate && dir.scope === true ||
							isIsolate && typeof dir.scope === typeof {}) {
							scope.view.addAnnotation(name, Service.DIR);
						}
					}
				}

				// Test for Class directives
				if (restrict.indexOf('C') > -1) {
					var matches = CLASS_DIRECTIVE_REGEXP.exec(node.className);
					if (matches) {
						for (var i = 0; i < matches.length; i++) {
							if (!matches[i]) continue;
							var normalized = NGI.Utils.directiveNormalize(matches[i]);
							if (normalized === name) {
								if (!isIsolate && dir.scope === true ||
									isIsolate && typeof dir.scope === typeof {}) {
									scope.view.addAnnotation(name, Service.DIR);
								}
							}
						}
					}
				}

			});
			break;
		case '$controllerProvider':

			app.registerProbe(function(node, scope) {

				if (node === document) {
					node = document.getElementsByTagName('html')[0];
				}

				// Test for the presence of the ngController directive
				for (var i = 0; i < node.attributes.length; i++) {
					var normalized = NGI.Utils.directiveNormalize(node.attributes[i].name);
					if (normalized === 'ngController') {
						scope.view.addAnnotation(node.attributes[i].value, Service.CTRL);
					}
				}

			});

			break;
	}
}

Service.CTRL = 1;
Service.DIR = 2;
Service.BUILTIN = 4;

Service.parseQueue = function(app, module) {
	var arr = [],
			queue = module._invokeQueue,
			tempQueue, i, j;
	for (i = 0; i < queue.length; i++) {
		if (queue[i][2].length === 1 && !(queue[i][2][0] instanceof Array)) {
			for (j in queue[i][2][0]) {
				if (Object.hasOwnProperty.call(queue[i][2][0], j)) {
					tempQueue = queue[i].slice();
					tempQueue[2] = [Object.keys(queue[i][2][0])[j], queue[i][2][0][j]];
					arr.push(new Service(app, module, tempQueue));
				}
			}
		} else {
			arr.push(new Service(app, module, queue[i]));
		}
	}
	return arr;
};

module.exports = Service;
