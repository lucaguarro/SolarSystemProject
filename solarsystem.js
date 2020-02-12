"use strict";

var vsSun = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;
uniform mat4 u_matrix;
out vec2 v_texcoord;
void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;
  // Pass the texcoord to the fragment shader.
  v_texcoord = a_texcoord;
}
`;

var fsSun = `#version 300 es
precision mediump float;
// Passed in from the vertex shader.
in vec2 v_texcoord;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
   outColor = texture(u_texture, v_texcoord);
}
`;

var vsMain2 = `#version 300 es

in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform vec3 u_sunWorldPosition;

uniform mat4 u_world;
uniform mat4 u_matrix; //worldViewProjection
uniform mat4 u_worldViewInverseTranspose;

out vec2 v_texcoord;
// varying to pass the normal to the fragment shader
out vec3 v_normal;
out vec3 v_objectToSun;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position; 

  // Pass the texcoord to the fragment shader.
  v_texcoord = a_texcoord;

  // orient the normals and pass to the fragment shader
  v_normal = mat3(u_worldViewInverseTranspose) * a_normal;

  // compute the world position of the surface
  vec3 surfaceWorldPosition = (u_world * a_position).xyz;
 
  // compute the vector of the surface to the light
  // and pass it to the fragment shader
  v_objectToSun = u_sunWorldPosition - surfaceWorldPosition;
}
`;

var fsMain2 = `#version 300 es
precision mediump float;
// Passed in from the vertex shader.
in vec2 v_texcoord;
in vec3 v_normal;
in vec3 v_objectToSun;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
   vec3 normal = normalize(v_normal);
   vec3 objectToSunDirection = normalize(v_objectToSun);
   float light = dot(normal, objectToSunDirection);
   outColor = texture(u_texture, v_texcoord);
   outColor.rgb *= (light+0.3);
}
`;

var vsSkybox = `#version 300 es
in vec4 a_position;
out vec4 v_position;
void main() {
  v_position = a_position;
  gl_Position = a_position;
}
`;


var fsSkybox = `#version 300 es
precision mediump float;
 
uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;
 
in vec4 v_position;
 
// we need to declare an output for the fragment shader
out vec4 outColor;
 
void main() {
  vec4 t = u_viewDirectionProjectionInverse * v_position;
  outColor = texture(u_skybox, normalize(t.xyz / t.w));
}
`;

var FizzyText = function() {
    this.Follow = 'dat.gui';
    this.speed = 1;
    this.distance = 1;
    this.displayOutline = false;
    // Define render logic ...
  };

var guiControls = new FizzyText();
  
window.onload = function() {
    //var text = new FizzyText();
    var gui = new dat.GUI();
    gui.add(guiControls, 'Follow', ['none', 'Sun', 'Mercury', 'Venus', 'Earth']);
    gui.add(guiControls, 'speed', 1, 1000);
    gui.add(guiControls, 'distance', 1, 2);
};
  

var TRS = function(){
    this.translation = [0,0,0];
    this.rotation = [0,0,0];
    this.scale = [1,1,1];
};

TRS.prototype.getMatrix = function(dst){
    dst = dst || new Float32Array(16);
    var t = this.translation;
    var r = this.rotation;
    var s = this.scale;
    m4.translation(t[0], t[1], t[2], dst);
    m4.zRotate(dst, r[2], dst);
    m4.xRotate(dst, r[0], dst);
    m4.yRotate(dst, r[1], dst);

    m4.scale(dst, s[0], s[1], s[2], dst);
    return dst;
};

var RTS = function(){
    this.translation = [0,0,0];
    this.rotation = [0,0,0];
    this.scale = [1,1,1];
};

RTS.prototype.getMatrix = function(dst){
    dst = dst || new Float32Array(16);
    var t = this.translation;
    var r = this.rotation;
    var s = this.scale;
    m4.zRotation(r[2], dst);
    m4.xRotate(dst, r[0], dst);
    m4.yRotate(dst, r[1], dst);

    m4.translate(dst, t[0], t[1], t[2], dst);
    m4.scale(dst, s[0], s[1], s[2], dst);
    return dst;
};

var Node = function(source) {
    this.children = [];
    this.localMatrix = m4.identity();
    this.worldMatrix = m4.identity();
    this.source = source;
};

Node.prototype.setParent = function(parent) {
    // remove us from our parent
    if (this.parent) {
        var ndx = this.parent.children.indexOf(this);
        if (ndx >= 0) {
            this.parent.children.splice(ndx, 1);
        }
    }

    // Add us to our new parent
    if (parent) {
        parent.children.push(this);
    }
    this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(parentWorldMatrix) {
    var source = this.source;
    if (source) {
        // performs matrix operations and changes this.localMatrix
        source.getMatrix(this.localMatrix);
    }

    if (parentWorldMatrix) {
        // a matrix was passed in so do the math
        m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
    } else {
        // no matrix was passed in so just copy local to world
        m4.copy(this.localMatrix, this.worldMatrix);
    }

    // now process all the children
    var worldMatrix = this.worldMatrix;

    this.children.forEach(function(child) {
        child.updateWorldMatrix(worldMatrix);
    });
};

//slowest = 0.0001, fastest = 0.1
var earthOrbitSpeed = 0.0001;
var earthRotationSpeed = earthOrbitSpeed * 365.25;
var earthOrbitsFactor = Object.freeze({"mercury":4.2, "venus":1.6, "mars":0.532, "jupiter":0.084, "saturn":0.034, "uranus":0.012, "neptune": 0.006, "pluto": 0.001,
                                        "Moon":12});
var earthRotationFactors = Object.freeze({"mercury":0.0170, "venus":-0.0041, "mars":0.9709, "jupiter":2.4096, "saturn":2.2472, "uranus":-0.28, "neptune": 1.4859, "pluto": 0.1560, "moon": 0.0365});

function incrementOrbits(nodeInfosByName){
    nodeInfosByName["earthOrbit"].source.rotation[1] += earthOrbitSpeed;

    //Planets - orbit around the sun about the sun's "y-axis"
    nodeInfosByName["mercuryOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.mercury;
    nodeInfosByName["venusOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.venus;
    nodeInfosByName["marsOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.mars;
    nodeInfosByName["jupiterOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.jupiter;
    nodeInfosByName["saturnOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.saturn;
    nodeInfosByName["uranusOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.uranus;
    nodeInfosByName["neptuneOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.neptune;
    nodeInfosByName["plutoOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.pluto;

    //moons
    nodeInfosByName["moonOrbit"].source.rotation[1] += earthOrbitSpeed*earthOrbitsFactor.Moon;
}

var axialTilts = Object.freeze({"mercury":0.0017, "venus": -0.0524,"earth":0.4014, "mars":0.4363, 
                "jupiter":0.0524, "saturn":0.4712, "uranus":0.1571, "neptune": 0.5236, "pluto": 0.303});

const EARTH_AXIAL_TILT = 0.5;

//To keep the planet's pole always facing the same direction, we need its position about the sun
//var theta = nodeInfosByName["earthOrbit"].source.rotation[1];
//The tilt is distributed between the object's x-axis and z-axis
function incrementRotations(nodeInfosByName){
    function rotationHelper(obj, angleAboutParent, tilt, factor){
        obj.source.rotation[0] = -tilt*Math.sin(angleAboutParent);
        obj.source.rotation[2] = tilt*Math.cos(angleAboutParent);
        obj.source.rotation[1] += earthRotationSpeed*factor;
    }
    rotationHelper(nodeInfosByName["earth"], nodeInfosByName["earthOrbit"].source.rotation[1], axialTilts.earth, 1);
    rotationHelper(nodeInfosByName["mercury"], nodeInfosByName["mercuryOrbit"].source.rotation[1], axialTilts.mercury, earthRotationFactors.mercury);
    rotationHelper(nodeInfosByName["venus"], nodeInfosByName["venusOrbit"].source.rotation[1], axialTilts.venus, earthRotationFactors.venus);
    rotationHelper(nodeInfosByName["mars"], nodeInfosByName["marsOrbit"].source.rotation[1], axialTilts.mars, earthRotationFactors.mars);
    rotationHelper(nodeInfosByName["jupiter"], nodeInfosByName["jupiterOrbit"].source.rotation[1], axialTilts.jupiter, earthRotationFactors.jupiter);
    rotationHelper(nodeInfosByName["saturn"], nodeInfosByName["saturnOrbit"].source.rotation[1], axialTilts.saturn, earthRotationFactors.saturn);
    rotationHelper(nodeInfosByName["uranus"], nodeInfosByName["uranusOrbit"].source.rotation[1], axialTilts.uranus, earthRotationFactors.uranus);
    rotationHelper(nodeInfosByName["neptune"], nodeInfosByName["neptuneOrbit"].source.rotation[1], axialTilts.neptune, earthRotationFactors.neptune);
    rotationHelper(nodeInfosByName["pluto"], nodeInfosByName["plutoOrbit"].source.rotation[1], axialTilts.pluto, earthRotationFactors.pluto);
}




function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl2");
    if (!gl) {
        return;
    }


    const textures = twgl.createTextures(gl, {
        sun: {src: "Resources/2k_sun.jpg"},
        mercury: {src: "Resources/2k_mercury.jpg"},
        venus: {src: "Resources/2k_venus_surface.jpg"},
        earth: {src: "Resources/2k_earth_daymap.jpg"},
        moon: {src: "Resources/2k_moon.jpg"},
        mars: {src: "Resources/2k_mars.jpg"},
        jupiter: {src: "Resources/2k_jupiter.jpg"},
        saturn: {src: "Resources/2k_saturn.jpg"},
        saturn_rings: {src: "Resources/saturnringcolor.jpg"},
        uranus: {src: "Resources/2k_uranus.jpg"},
        neptune: {src: "Resources/2k_neptune.jpg"},
        pluto: {src: "Resources/2k_pluto.jpg"}
    });

    // Tell the twgl to match position with a_position,
    // normal with a_normal etc. This is so that the createVAOFromBufferInfo can bind to 
    // the names of the variables in our shaders.
    twgl.setAttributePrefix("a_");

    // setup GLSL program
    var sunProgramInfo = twgl.createProgramInfo(gl, [vsSun, fsSun]);
    var mainProgramInfo = twgl.createProgramInfo(gl, [vsMain2, fsMain2]);
    var skyboxProgramInfo = twgl.createProgramInfo(gl, [vsSkybox, fsSkybox]);

    const quadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
        position: [
          -1, -1, 1,
           1, -1, 1,
          -1,  1, 1,
          -1,  1, 1,
           1, -1, 1,
           1,  1, 1,
        ],
      });
    var sphereBufferInfo = twgl.primitives.createSphereBufferInfo(gl, 1, 24, 12);
    var ringBufferInfo = twgl.primitives.createDiscBufferInfo(gl, 7, 25, 2, 5, 2);

    var quadVAO = twgl.createVAOFromBufferInfo(gl, skyboxProgramInfo, quadBufferInfo);
    var sphereVAO = twgl.createVAOFromBufferInfo(gl, mainProgramInfo, sphereBufferInfo);
    var ringVAO = twgl.createVAOFromBufferInfo(gl, mainProgramInfo, ringBufferInfo);

    const skyMapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyMapTexture);

    // we can use a twgl function for this
    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            url: './Resources/skybox/skybox_px.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: './Resources/skybox/skybox_nx.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            url: './Resources/skybox/skybox_py.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: './Resources/skybox/skybox_ny.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: './Resources/skybox/skybox_pz.jpg',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            url: './Resources/skybox/skybox_nz.jpg',
        },
    ];
    faceInfos.forEach((faceInfo) => {
        const {target, url} = faceInfo;
    
        // Upload the canvas to the cubemap face.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 877;
        const height = 877;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
    
        // setup each face so it's immediately renderable
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);
    
        // Asynchronously load an image
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function() {
        // Now that the image has loaded make copy it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyMapTexture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        });
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    var objectsToDraw_BCull = [];
    var objectsToDraw_NoCull = [];
    var objects = [];
    var nodeInfosByName = {}; // Dictionary

    var SHAPES = Object.freeze({"sphere":1, "ring": 2})
    var CULLS = Object.freeze({"nocull":0, "backcull": 1})

    var solarSystemNode =
        {
        
        name: "solar system",
        draw: false,
        children: [
            {
                name: "sun",
                programInfo: sunProgramInfo,
                scale: [5, 5, 5],
                cull: CULLS.backcull,
                uniforms: {
                    u_colorOffset: [0.6, 0.6, 0, 1], // yellow
                    u_colorMult:   [0.4, 0.4, 0, 1],
                    u_texture: textures.sun,
                },
            },
            {
                name: "mercuryOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.1107],
                translation: [20, 0, 0],
                children: [
                    {
                        name: "mercury",
                        programInfo: mainProgramInfo,
                        scale: [2, 2, 2],
                        rotation: [0.0017, 0, 0], //rotational tilt
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.mercury,
                        },
                    }
                ]
            },
            {
                name: "venusOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0382],
                translation: [30, 0, 0],
                children: [
                    {
                        name: "venus",
                        programInfo: mainProgramInfo,
                        scale: [3, 3, 3],
                        rotation: [-0.0524, 0, 0],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.venus,
                        },
                    }
                ]
            },
            {
                name: "earthOrbit",
                draw: false,
                nodeType: RTS, // Is RTS/TRS to keep the north pole the same? CHECK FIXME
                rotation: [0, 0, 0.0274], // [x,y,z] where z is into the page. So altering the z, will make the x translation appear higher at the start
                translation: [40, 0, 0],
                children: [
                    {
                        name: "earth",
                        programInfo: mainProgramInfo,
                        scale: [3, 3, 3],
                        rotation: [0.4014, 0, 0],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.earth,
                        },
                    },
                    {
                        name: "moonOrbit",
                        draw: false,
                        nodeType: RTS,
                        translation: [5, 0, 0],
                        rotation: [0, 0, 0.09],
                        children: [
                            {
                                name: "moon",
                                programInfo: mainProgramInfo,
                                scale: [1.4, 1.4, 1.4],
                                cull: CULLS.backcull,
                                uniforms: {
                                    u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
                                    u_colorMult:   [0.1, 0.1, 0.1, 1],
                                    u_texture: textures.moon,
                                },
                            },
                        ],
                    },
                ],

            },
            {
                name: "marsOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0291],
                translation: [50, 0, 0],
                children: [
                    {
                        name: "mars",
                        programInfo: mainProgramInfo,
                        scale: [3, 3, 3],
                        rotation: [0.4363, 0, 0],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.mars,
                        },
                    }
                ]
            },
            {
                name: "jupiterOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0056],
                translation: [60, 0, 0],
                children: [
                    {
                        name: "jupiter",
                        programInfo: mainProgramInfo,
                        scale: [5, 5, 5],
                        rotation: [0.4, 0, 0],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.jupiter,
                        },
                    }
                ]
            },
            {
                name: "saturnOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0162],
                translation: [75, 0, 0],
                children: [
                    {
                        name: "saturn",
                        programInfo: mainProgramInfo,
                        scale: [4, 4, 4],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.saturn,
                        },
                    },
                    {
                        name: "saturnRings",
                        programInfo: sunProgramInfo,
                        shapeType: SHAPES.ring,
                        rotation: [-0.5, 0, 0],
                        cull: CULLS.nocull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.saturn_rings,
                        },
                    }
                ]
            },
            {
                name: "uranusOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0178],
                translation: [90, 0, 0],
                children: [
                    {
                        name: "uranus",
                        programInfo: mainProgramInfo,
                        scale: [4, 4, 4],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.uranus,
                        },
                    }
                ]
            },
            {
                name: "neptuneOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.0126],
                translation: [100, 0, 0],
                children: [
                    {
                        name: "neptune",
                        programInfo: mainProgramInfo,
                        scale: [4, 4, 4],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.neptune,
                        },
                    }
                ]
            },
            {
                name: "plutoOrbit",
                draw: false,
                nodeType: RTS,
                rotation: [0, 0, 0.2714],
                translation: [110, 0, 0],
                children: [
                    {
                        name: "pluto",
                        programInfo: mainProgramInfo,
                        scale: [1, 1, 1],
                        cull: CULLS.backcull,
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                            u_texture: textures.pluto,
                        },
                    }
                ]
            },
        ],
        };

    function getBufferInfo(shapeType){
        if(shapeType !== SHAPES.ring){
            return sphereBufferInfo;
        }
        else{
            return ringBufferInfo;
        }
    }

    function getVAO(shapeType){
        if(shapeType !== SHAPES.ring){
            return sphereVAO;
        }
        else{
            return ringVAO;
        }
    }

    /**
     * Given a root node in JSON, it will create all the objects needed for the vertex/fragment shaders. 
     * It will do this recursively to keep track of the scene graph through makeNodes.
     */
    function makeNode(nodeDescription) {
        var source = new (nodeDescription.nodeType || TRS); // If the nodeType is not defined, it will be set to TRS
        var node = new Node(source); 
        nodeInfosByName[nodeDescription.name] = {
            source: source,
            node: node,
        };
        source.rotation = nodeDescription.rotation || source.rotation;
        source.translation = nodeDescription.translation || source.translation;
        source.scale = nodeDescription.scale || source.scale;
        if (nodeDescription.draw !== false) {
            node.drawInfo = {
                uniforms: nodeDescription.uniforms,
                programInfo: nodeDescription.programInfo,
                bufferInfo: getBufferInfo(nodeDescription.shapeType),
                vertexArray: getVAO(nodeDescription.shapeType),
            };
            if (nodeDescription.cull === CULLS.backcull){
                objectsToDraw_BCull.push(node.drawInfo);
            }
            else{
                objectsToDraw_NoCull.push(node.drawInfo);
            }
            objects.push(node);
        }
        makeNodes(nodeDescription.children).forEach(function(child) { 
            child.setParent(node);
        });
        return node;
    }

    // If nodeDescriptions exists, create the nodes
    function makeNodes(nodeDescriptions) {
        return nodeDescriptions ? nodeDescriptions.map(makeNode) : []; //actually goes about making the child
    }

    var scene = makeNode(solarSystemNode);

    requestAnimationFrame(drawScene);

    // Compute the camera's matrix using look at.
    setupControls(canvas);
    function modifyViewProjection(vpMatrix){
        m4.translate(vpMatrix, -trackLeftRight, 0, 0, vpMatrix);
        m4.translate(vpMatrix, 0, -craneUpDown, 0, vpMatrix);
        m4.translate(vpMatrix, 0, 0, pushInPullOut, vpMatrix);
        m4.xRotate(vpMatrix, pitchAngle, vpMatrix);
        m4.yRotate(vpMatrix, yawAngle, vpMatrix);
        m4.zRotate(vpMatrix, rollAngle, vpMatrix);    
    }
    // Draw the scene.
    function drawScene(time) {
        time *= 0.0005;

        twgl.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        //gl.clearColor(0, 0, 0, 1);//TEST what this does
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix = m4.perspective(fov, aspect, 1, 2000);

        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);
        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        // Camera controls by user
        modifyViewProjection(viewProjectionMatrix);

        earthOrbitSpeed = 0.0001*guiControls.speed || 0.0001;
        incrementOrbits(nodeInfosByName);
        incrementRotations(nodeInfosByName);

        // Update all world matrices in the scene graph
        scene.updateWorldMatrix();

        // Compute all the matrices for rendering
        // We update u_matrix for each object so the vertex shader can draw it
        objects.forEach(function(object) {
            var MV = m4.multiply(viewProjectionMatrix, object.worldMatrix);
            object.drawInfo.uniforms.u_world = object.worldMatrix;
            object.drawInfo.uniforms.u_matrix = MV; //m4.multiply(viewProjectionMatrix, object.worldMatrix); // Sets u_matrix to be in camera space
            object.drawInfo.uniforms.u_worldViewInverseTranspose = m4.transpose(m4.inverse(object.worldMatrix));
            object.drawInfo.uniforms.u_sunWorldPosition = [0,0,0];//[objects[0].drawInfo.uniforms[12], objects[0].drawInfo.uniforms[13], objects[0].drawInfo.uniforms[14]]; //gets the position of the sun
        });

        var viewDirectionMatrix = m4.copy(viewMatrix);
        viewDirectionMatrix[12] = 0;
        viewDirectionMatrix[13] = 0;
        viewDirectionMatrix[14] = 0;

        // for the skybox
        var viewDirectionProjectionMatrix = m4.multiply(projectionMatrix, viewDirectionMatrix);
        modifyViewProjection(viewDirectionProjectionMatrix);
        var viewDirectionProjectionInverseMatrix = m4.inverse(viewDirectionProjectionMatrix);
        var skyboxDrawInfo = {uniforms: {
                                            u_viewDirectionProjectionInverse: viewDirectionProjectionInverseMatrix,
                                            u_skybox: skyMapTexture,
                                        },
                              programInfo: skyboxProgramInfo,
                              bufferInfo: quadBufferInfo,
                              vertexArray: quadVAO,
        };
        gl.useProgram(mainProgramInfo.program);
        // ------- Draw the objects --------
        gl.depthFunc(gl.LESS);   // added -------------
        gl.enable(gl.CULL_FACE);
        twgl.drawObjectList(gl, objectsToDraw_BCull);
        gl.disable(gl.CULL_FACE);
        twgl.drawObjectList(gl, objectsToDraw_NoCull);
        gl.depthFunc(gl.LEQUAL);   // added -------------
        twgl.drawObjectList(gl, [skyboxDrawInfo]);
        
        requestAnimationFrame(drawScene);
    }
}

main();

// function loadImageTexture(url) {
//     // Create a texture.
//     const texture = gl.createTexture();
//     gl.bindTexture(gl.TEXTURE_2D, texture);
//     // Fill the texture with a 1x1 blue pixel.
//     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
//                   new Uint8Array([0, 0, 255, 255]));
//     // Asynchronously load an image
//     const image = new Image();
//     image.src = url;
//     image.addEventListener('load', function() {
//       // Now that the image has loaded make copy it to the texture.
//       gl.bindTexture(gl.TEXTURE_2D, texture);
//       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
//       // assumes this texture is a power of 2
//       gl.generateMipmap(gl.TEXTURE_2D);
//       console.log("yo");
//       //render();
//     });
//     return texture;
//   }