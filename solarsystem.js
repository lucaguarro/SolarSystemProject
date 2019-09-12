"use strict";

var vs = `#version 300 es

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

var fs = `#version 300 es
precision mediump float;

// Passed in from the vertex shader.
in vec2 v_texcoord;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
   outColor = texture(u_texture, v_texcoord);
}
`;

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
    m4.xRotate(dst, r[0], dst);
    m4.yRotate(dst, r[1], dst);
    m4.zRotate(dst, r[2], dst);
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
    m4.xRotation(r[0], dst);
    m4.yRotate(dst, r[1], dst);
    m4.zRotate(dst, r[2], dst);
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

function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl2");
    if (!gl) {
        return;
    }
    function loadImageTexture(url) {
        // Create a texture.
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Fill the texture with a 1x1 blue pixel.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([0, 0, 255, 255]));
        // Asynchronously load an image
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function() {
          // Now that the image has loaded make copy it to the texture.
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          // assumes this texture is a power of 2
          gl.generateMipmap(gl.TEXTURE_2D);
          console.log("yo");
          //render();
        });
        return texture;
      }
       

    loadImageTexture('Resources/2k_sun.jpg');
    // const textureSun = twgl.createTexture(gl, {
    //     sun: { src: "Resources/2k_sun.jpg", mag: gl.NEAREST }
    // });

    setupControls(canvas);

    // Tell the twgl to match position with a_position, n
    // normal with a_normal etc..
    twgl.setAttributePrefix("a_");

    var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 12, 6);
    // setup GLSL program
    var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

    var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);

    var objectsToDraw = [];
    var objects = [];
    var nodeInfosByName = {};

    var solarSystemNode =
        {
        name: "solar system",
        draw: false,
        children: [
            {
                name: "sun",
                scale: [70, 70, 70],
                surface: "Resources/2k_sun.jpg",
                uniforms: {
                    u_colorOffset: [0.6, 0.6, 0, 1], // yellow
                    u_colorMult:   [0.4, 0.4, 0, 1],
                    //u_texture: textures.sun,
                },
            },
            {
                name: "mercuryOrbit",
                draw: false,
                nodeType: RTS,
                translation: [3948, 0, 0],
                children: [
                    {
                        name: "mercury",
                        scale: [2, 2, 2],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "venusOrbit",
                draw: false,
                nodeType: RTS,
                translation: [7208, 0, 0],
                children: [
                    {
                        name: "venus",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "earthOrbit",
                draw: false,
                nodeType: RTS,
                translation: [9976, 0, 0],
                children: [
                    {
                        name: "earth",
                        scale: [5.2, 5.2, 5.2],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    },
                    {
                        name: "moonOrbit",
                        draw: false,
                        nodeType: RTS,
                        translation: [156, 0, 0],
                        children: [
                            {
                                name: "moon",
                                scale: [1.4, 1.4, 1.4],
                                uniforms: {
                                    u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
                                    u_colorMult:   [0.1, 0.1, 0.1, 1],
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
                translation: [15125, 0, 0],
                children: [
                    {
                        name: "mars",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "jupiterOrbit",
                draw: false,
                nodeType: RTS,
                translation: [51874, 0, 0],
                children: [
                    {
                        name: "jupiter",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "saturnOrbit",
                draw: false,
                nodeType: RTS,
                translation: [95091, 0, 0],
                children: [
                    {
                        name: "saturn",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "uranusOrbit",
                draw: false,
                nodeType: RTS,
                translation: [191332, 0, 0],
                children: [
                    {
                        name: "uranus",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "neptuneOrbit",
                draw: false,
                nodeType: RTS,
                translation: [299832, 0, 0],
                children: [
                    {
                        name: "neptune",
                        scale: [5, 5, 5],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
            {
                name: "plutoOrbit",
                draw: false,
                nodeType: RTS,
                translation: [393679, 0, 0],
                children: [
                    {
                        name: "pluto",
                        scale: [1, 1, 1],
                        uniforms: {
                            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                            u_colorMult:   [0.8, 0.5, 0.2, 1],
                        },
                    }
                ]
            },
        ],
        };

    function makeNode(nodeDescription) {
        var source = new (nodeDescription.nodeType || TRS);
        var node = new Node(source);
        nodeInfosByName[nodeDescription.name] = {
        source: source,
        node: node,
        };
        source.translation = nodeDescription.translation || source.translation;
        source.scale = nodeDescription.scale || source.scale;
        if (nodeDescription.draw !== false) {
        node.drawInfo = {
            uniforms: nodeDescription.uniforms,
            programInfo: programInfo,
            bufferInfo: sphereBufferInfo,
            vertexArray: sphereVAO,
        };
        objectsToDraw.push(node.drawInfo);
        objects.push(node);
        }
        makeNodes(nodeDescription.children).forEach(function(child) {
        child.setParent(node);
        });
        return node;
    }

    // If nodeDescriptions exists, create the nodes
    function makeNodes(nodeDescriptions) {
        return nodeDescriptions ? nodeDescriptions.map(makeNode) : [];
    }

    var scene = makeNode(solarSystemNode);

    requestAnimationFrame(drawScene);

    // Compute the camera's matrix using look at.
    var cameraPosition = [0, 4000, -20000];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    // Draw the scene.
    function drawScene(time) {
        time *= 0.0005;

        twgl.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clearColor(0, 0, 0, 1);//TEST what this does
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix = m4.perspective(fov, aspect, 1, 300000);

        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        m4.translate(viewProjectionMatrix, -trackLeftRight, 0, 0, viewProjectionMatrix);
        m4.translate(viewProjectionMatrix, 0, -craneUpDown, 0, viewProjectionMatrix);
        m4.translate(viewProjectionMatrix, 0, 0, pushInPullOut, viewProjectionMatrix);
        m4.xRotate(viewProjectionMatrix, pitchAngle, viewProjectionMatrix);
        m4.yRotate(viewProjectionMatrix, yawAngle, viewProjectionMatrix);
        m4.zRotate(viewProjectionMatrix, rollAngle, viewProjectionMatrix);
        
        nodeInfosByName["earthOrbit"].source.rotation[1] += 0.001;
        nodeInfosByName["moonOrbit"].source.rotation[1] += 0.01;
        nodeInfosByName["earth"].source.rotation[1] += 0.05;
        nodeInfosByName["moon"].source.rotation[1] += -.01;

        // Update all world matrices in the scene graph
        scene.updateWorldMatrix();
        // Compute all the matrices for rendering
        // We update u_matrix for each object so the vertex shader can draw it
        objects.forEach(function(object) {
            object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
        });

        // ------ Draw the objects --------
        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
    }
}

window.onload = main;