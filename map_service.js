'use strict';
define([
    'angularMapApp/services/map_service'
], function (map_service) {
    var module = angular.module('mapService', []);
    
    module.factory('MapSvc', ['$rootScope', '$http', '$q', '$filter', '$injector',
        function ($rootScope, $http, $q, $filter, $injector) {
            var mapGraphics = [];
            var selGraphic = {};
            var editMode = '';
            var legendLyrs = {};

            var ulaSymbols = [];

            function maybeApply() {
                if ($rootScope.$root.$$phase != '$apply' && $rootScope.$root.$$phase != '$digest') {
                    $rootScope.$apply();
                }
            }

            function _setSelGraphic(g, symPrefix) {
                console.log('setting sel graphic', g);
                if (g && g.geometry) {
                    var selG = {
                            geometry: g.geometry,
                            attributes: g.attributes,
                            infoTemplate: g.infoTemplate
                    };
                    if (!symPrefix) {
                        symPrefix = 'sel';
                    }
                    var symSuffix;
                    if (selG.geometry.hasOwnProperty('x') && selG.geometry.hasOwnProperty('y')) {
                        symSuffix = 'Point';
                    } else if (selG.geometry.hasOwnProperty('paths')) {
                        symSuffix = 'Line';
                    } else if (selG.geometry.hasOwnProperty('rings')) {
                        symSuffix = 'Poly';
                    }
                    selG.symbol = _getSymbol(symPrefix + symSuffix);
                    selGraphic = selG;
                } else
                    selGraphic = {};
                maybeApply();
            }

            var urlConfig = "";
            var URLROOT = "";
            function _loadConfig() {
                // Store config as JSON in external location.
                // Load it here with $http service.
                var deferred = $q.defer();
                $http.get("./scripts/services/urlConfig.json")
                    .success(function(data, status, headers, config) {
                        deferred.resolve(data);
                        }
                    )
                    .error(function(errmsg, status){
                        deferred.reject(errmsg);
                        }
                    );
                return deferred.promise;
            }

            function _setConfig() {
                var urlConfigPromise = _loadConfig();
                urlConfigPromise.then(
                    function(resp) {
                        urlConfig = resp;
                        URLROOT = urlConfig["webServiceRootURL"];
                    },
                    function(error) {
                        URLROOT = "";
                    }
                );
            }
            _setConfig();

            function _getSymbol(type) {
                var sym;
                switch (type) {

                    // **POINTS**
                    case 'defaultPoint':
                        sym = { "color": [0, 0, 0, 128], "size": 10, "angle": 0, "xoffset": 0, "yoffset": 0, "type": "esriSMS", "style": "esriSMSCircle",
                                "outline": { "color": [0, 0, 0, 255], "width": 1, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'nullPoint':
                        sym = {
                            "color": [0, 0, 0, 0], "size": 0, "angle": 0, "xoffset": 0, "yoffset": 0, "type": "esriSMS", "style": "esriSMSCircle",
                            "outline": { "color": [0, 0, 0, 0], "width": 0, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'selPoint':
                        sym = { "color": [255, 255, 0, 200], "size": 10, "angle": 0, "xoffset": 0, "yoffset": 0, "type": "esriSMS", "style": "esriSMSCircle",
                                "outline": { "color": [0, 0, 0, 255],"width": 1, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'editPoint':
                        sym = { "color": [255, 255, 0, 128], "size": 10, "angle": 0, "xoffset": 0, "yoffset": 0, "type": "esriSMS", "style": "esriSMSCircle",
                                "outline": { "color": [250, 0, 0, 255], "width": 1, "type": "esriSLS", "style": "esriSLSSolid"}
                        }; break;

                    // **LINES**
                    case 'defaultLine':
                        sym = { "color": [0, 0, 0, 128], "width": 2, "type": "esriSLS", "style": "esriSLSSolid" };
                        break;
                    case 'selLine':
                        sym = { "color": [255, 255, 0, 255], "width": 1, "type": "esriSLS", "style": "esriSLSSolid" };
                        break;
                    case 'editLine':
                        sym = { "color": [250, 0, 0, 128], "width": 2, "type": "esriSLS", "style": "esriSLSSolid" };
                        break;

                    // **POLYS**
                    case 'defaultPoly':
                        sym = {
                            "color": [128, 128, 128, 128], "type": "esriSFS", "style": "esriSFSSolid",
                            "outline": { "color": [0, 0, 0, 255], "width": 2, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'selPoly':
                        sym = {
                            "color": [255, 255, 0, 128], "type": "esriSFS", "style": "esriSFSSolid",
                            "outline": { "color": [255, 255, 0, 128], "width": 2, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'editPoly':
                        sym = {
                            "color": [255, 255, 0, 128], "type": "esriSFS", "style": "esriSFSSolid",
                            "outline": { "color": [250, 0, 0, 128], "width": 2, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                    case 'filteredPoly':
                        sym = {
                            "color": [180, 140, 130, 140], "type": "esriSFS", "style": "esriSFSSolid",
                            "outline": { "color": [255, 255, 255, 255], "width": 1, "type": "esriSLS", "style": "esriSLSSolid" }
                        }; break;
                }
                return sym;
            }

            function _dbRowsToGraphics(dbFeatArr, symbolType, filterObj, hideFilteredOnMap) { // all optional (returns [] if nothing defined)
                var gArr = [];                                          // graphic array to be returned
                if (dbFeatArr) {                                        // don't do anytyhing if there's nothing to do
                    for (var i = 0; i < dbFeatArr.length; i++) {        // loop thru db results
                        var g = { attributes: {} };                     // the graphic to be added
                        var dbFeat = dbFeatArr[i];                      // the feature as it came from the db
                        // ***SYMBOL***
                        var symPrefix;
                        if (symbolType == undefined || symbolType == '')        // if symbol type is not defined...
                            symbolType = 'default';                             // ...use default symbol
                        if (filterObj && ($filter('filter')([dbFeat], filterObj, true)).length == 0) {
                            if (hideFilteredOnMap)
                                continue;                               // skip this db feature if it's to be filter from map
                            symPrefix = 'filtered';                     // override symbolType if filter is applied
                        }
                        else
                            symPrefix = symbolType;
                        // ***GEOMETRY***
                        for (var prop in dbFeat) {  // loop thru all properties on the feature
                            if (prop == 'geometry') { // if processing geometry, turn it into ArcGIS Graphic
                                var geomType = '';
                                var geomStr = '';
                                if (dbFeat.geometry) { //POINT (30 10)   LINESTRING (30 10, 40 20, 50 40)  POLYGON ((1 9, 2 8, 3 7, 4 6))
                                    geomType = dbFeat.geometry.substring(0, dbFeat.geometry.indexOf('(')).trim();
                                    geomStr = dbFeat.geometry.substring(dbFeat.geometry.indexOf('('));
                                }
                                var geomObj;
                                switch (geomType) {
                                    case 'POINT':
                                    case 'POINT ZM':
                                        g.symbol = _getSymbol(symPrefix + 'Point');
                                        // POINT (30 10)   POINT ZM (30 10 5.2)
                                        // { x: 30, y: 10, spatialReference: {wkid: 102100} }
                                        // geomStr is "(30 10)"
                                        geomStr = geomStr.replace(/\(/g, '').replace(/\)/g, '');    // "30 10"
                                        var ptArr = geomStr.split(' ');                             // [30,10]
                                        geomObj = { x: parseFloat(ptArr[0]), y: parseFloat(ptArr[1]), spatialReference: { wkid: 102100 } };
                                        g.geometry = geomObj;
                                        break;
                                    case 'LINESTRING':
                                        g.symbol = _getSymbol(symPrefix + 'Line');
                                        // LINESTRING (30 10,10 30,40 40)
                                        // { paths: [[[30, 10], [10, 30], [40, 40]]], spatialReference: {wkid:102100} }
                                        // geomStr is "(30 10,10 30,40 40)"
                                        geomStr = geomStr.replace(/\(/g, '[').replace(/\)/g, ']');  // [30 10,10 30,40 40]
                                        geomStr = geomStr.replace(/,/g, "],[");                     // [30 10],[10 30],[40 40]
                                        geomStr = geomStr.replace(/ /g, ",");                       // [30,10],[10,30],[40,40]
                                        geomStr = "[[" + geomStr + "]]";                            // [[[30 10],[10 30],[40 40]]]
                                        geomObj = JSON.parse(geomStr);
                                        g.geometry = { paths: geomObj, spatialReference: { wkid: 102100 } };
                                        break;
                                    case 'POLYGON':
                                        g.symbol = _getSymbol(symPrefix + 'Poly');
                                        // POLYGON ( (35 10,45 45,15 40), (20 30,35 35,30 20,20 30) )
                                        // { rings: [[[35,10],[45,45],[15,40]],[[20,30],[35,35],[30,20],[20,30]]], spatialReference: {wkid: 102100} }
                                        // geomStr is "( (35 10,45 45,15 40), (20 30,35 35,30 20,20 30) )"
                                        geomStr = geomStr.replace(/\( /g, "["); // first "(" is followed by a space, but we replace all spaces with "," down below
                                        geomStr = geomStr.replace(/\(/g, "[").replace(/\)/g, "]");  // [[35 10,45 45,15 40],[20 30,35 35,30 20,20 30]]
                                        geomStr = geomStr.replace(/,/g, "],[");                     // [[35 10],[45 45],[15 40]],[[20 30],[35 35],[30 20],[20 30]]
                                        geomStr = geomStr.replace(/ /g, ",");                       // [[35,10],[45,45],[15,40]],[[20,30],[35,35],[30,20],[20,30]]
                                        geomStr = "[" + geomStr + "]";                              // [[[35,10],[45,45],[15,40]],[[20,30],[35,35],[30,20],[20,30]]]
                                        geomObj = JSON.parse(geomStr);
                                        g.geometry = { rings: geomObj, spatialReference: { wkid: 102100 } };
                                        break;
                                    default:
                                        g.symbol = _getSymbol('nullPoint');
                                        g.geometry = { x: 1234, y: 1234, spatialReference: { wkid: 102100 } };
                                        break;
                                }
                            }
                            // ***ATTRIBUTES***
                            // add property to Graphic's attributes object (includes POSTGRES geometry)
                            g.attributes[prop] = dbFeat[prop];
                        } // END FOR loop for properties
                        gArr.push(g);
                    } // END FOR for db feature arr
                } // END IF db feature array is defined

                return gArr;
            }

            function _agsToPGGeom(g) {
                var gType = '';
                var pgGeomStr = '';
                if (g) {
                    if (g.hasOwnProperty('x') && g.hasOwnProperty('y')) {
                        gType = 'point';
                    } else if (g.hasOwnProperty('paths')) {
                        gType = 'polyline';
                    } else if (g.hasOwnProperty('rings')) {
                        gType = 'polygon';
                    } else if (g.type == 'extent') {
                        gType = 'extent';
                    }
                }
                var pgGeomStr = '';
                switch (gType) {
                    case 'point':
                        // POINT (30 10)
                        // { x: 123, y: 456, spatialReference: {wkid: 102100} }
                        pgGeomStr = 'POINT(' + g.x + ' ' + g.y + ')';
                        break;
                    case 'polyline':
                        // LINESTRING (30 10, 10 30, 40 40)
                        // { paths: [[[-122.68,45.53], [-122.58,45.55],[-122.57,45.58],[-122.53,45.6]]], spatialReference: {wkid:102100} }
                        pgGeomStr = 'LINESTRING(';
                        for (var i = 0; i < g.paths[0].length; i++) {
                            if (i > 0) pgGeomStr += ',';
                            pgGeomStr += g.paths[0][i][0] + ' ' + g.paths[0][i][1];
                        }
                        pgGeomStr += ')';
                        break;
                    case 'extent': // convert extent to polygon and fall-thru to case 'polygon'
                        g.rings = [[
                            [g.xmin, g.ymin], [g.xmin, g.ymax],
                            [g.xmax, g.ymax], [g.xmax, g.ymin],
                            [g.xmin, g.ymin]
                        ]];
                        // NO BREAK, FALL-THRU TO POLYGON
                    case 'polygon':
                        //   POLYGON ((35 10, 45 45, 15 40), (20 30, 35 35, 30 20, 20 30))
                        // { rings: [[[35,10],[45,45],[15,40]],[[20,30],[35,35],[30,20],[20,30]]], spatialReference: {wkid: 102100} }
                        pgGeomStr = 'POLYGON(';
                        for (var i = 0; i < g.rings.length; i++) {
                            if (i > 0) pgGeomStr += ',';
                            pgGeomStr += '(';
                            for (var j = 0; j < g.rings[i].length; j++) {
                                if (j > 0) pgGeomStr += ',';
                                pgGeomStr += g.rings[i][j][0] + ' ' + g.rings[i][j][1];
                            }
                            pgGeomStr += ')';
                        }
                        pgGeomStr += ')';
                        break;
                }

                return pgGeomStr;
            }

            return {
                getMapGraphics: function () {
                    return mapGraphics;
                },
                setMapGraphics: function (mg) {
                    mapGraphics = mg;
                },
                graphicClickHandler: function (e) {
                    if (editMode == '' || editMode == 'selCLUGeom') {
                        if (e.graphic.attributes == selGraphic.attributes) {
                            _setSelGraphic({});
                        }
                    }
                },
                getSelGraphic: function () {
                    return selGraphic;
                },
                setSelGraphic: function (g) {
                    _setSelGraphic(g);
                },
                clearAllGraphics: function () {
                    _setSelGraphic();
                },
                dbRowsToGraphics: function (dbFeatArr, symbolType, filterObj, hideFiltered) {
                    return _dbRowsToGraphics(dbFeatArr, symbolType, filterObj, hideFiltered);
                },
                agsGeomToPGGeom: function (g) {
                    return _agsToPGGeom(g);
                },
                getSymbol: function (t) {
                    return _getSymbol(t);
                },
                getEditMode: function () {
                    return editMode;
                },
                setEditMode: function (m) {
                    if (m.indexOf('add') == 0)
                        _setSelGraphic({});
                    editMode = m;
                },
                loadLegend: function (lyrs) {
                    //console.log('LEGEND', legendLyrs);
                    for (var i = 0; i < lyrs.length; i++) {
                        if (lyrs[i].layer.url && !legendLyrs.hasOwnProperty(lyrs[i].layer.url)) {
                            //var url = lyrs[i].layer.url + '/legend?f=json&callback=JSON_CALLBACK';
                            legendLyrs[lyrs[i].layer.url] = {};
                            $http.jsonp(lyrs[i].layer.url + '/legend?f=json&callback=JSON_CALLBACK')
                                .success(function (data, status, headers, config) {

                                    //console.log("LEGEND SUCCESS", data, config);
                                    var url = config.url.substring(0, config.url.indexOf('/legend'));
                                    legendLyrs[url] = data.layers;
                                })
                                .error(function (data, status, headers, config) {
                                    console.log("ERROR with LEGEND", data, config);
                                });

                        }
                    }
                },
                getLegend: function (url) {
                    if (legendLyrs.hasOwnProperty(url))
                        return legendLyrs[url];
                    else
                        return null;
                }

            }; // END return
        } // END function
    ]); // END factory
    
    return module;
});
