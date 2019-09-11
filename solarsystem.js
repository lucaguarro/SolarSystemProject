"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision mediump float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
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

    // Tell the twgl to match position with a_position, n
    // normal with a_normal etc..
    twgl.setAttributePrefix("a_");

    var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 12, 6);

    // setup GLSL program
    var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

    var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);

    function degToRad(d) {
    return d * Math.PI / 180;
    }

    function rand(min, max) {
    return Math.random() * (max - min) + min;
    }

    function emod(x, n) {
    return x >= 0 ? (x % n) : ((n - (-x % n)) % n);
    }


    var cameraAngleRadians = degToRad(0);
    var fieldOfViewRadians = degToRad(60);
    var cameraHeight = 50;

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
            scale: [5, 5, 5],
            uniforms: {
                u_colorOffset: [0.6, 0.6, 0, 1], // yellow
                u_colorMult:   [0.4, 0.4, 0, 1],
            },
            },
            {
            name: "earthOrbit",
            draw: false,
            nodeType: RTS,
            translation: [100, 0, 0],
            children: [
                {
                name: "earth",
                scale: [2, 2, 2],
                uniforms: {
                    u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
                    u_colorMult:   [0.8, 0.5, 0.2, 1],
                },
                },
                {
                name: "moonOrbit",
                draw: false,
                nodeType: RTS,
                translation: [30, 0, 0],
                children: [
                    {
                    name: "moon",
                    scale: [0.4, 0.4, 0.4],
                    uniforms: {
                        u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
                        u_colorMult:   [0.1, 0.1, 0.1, 1],
                    },
                    },
                ],
                },
            ],

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
        var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

        // Compute the camera's matrix using look at.
        var cameraPosition = [0, 0, -200];
        var target = [0, 0, 0];
        var up = [0, 1, 0];
        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        nodeInfosByName["earthOrbit"].source.rotation[1] += 0.01;
        nodeInfosByName["moonOrbit"].source.rotation[1] += 0.01;
        nodeInfosByName["earth"].source.rotation[1] += 0.05;
        nodeInfosByName["moon"].source.rotation[1] += -.01;

        // Update all world matrices in the scene graph
        scene.updateWorldMatrix();
        // Compute all the matrices for rendering
        objects.forEach(function(object) {
            object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
        });

        // ------ Draw the objects --------
        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
    }
}

window.onload = main;