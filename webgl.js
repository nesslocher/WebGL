var gl;
var vertices = [];
var viewGL = 0;
let activeVertices = vertices;
let showVertices = false;
let mainVBO = null;
let verticesModel = [];
let verticesGround = [];

let twistGL; 
let normalMatrixGL;

//uv 
var textures = [];
var currentTextureIndex = 0;
var display = [ 0.0, 0.0, 0.0, 0.0 ]
var displayGL = 0; 

let hasLogged = false;
let canvas;

const camera = {
    position: [0, 0, 3],
    yaw: 0,
    pitch: 0
};

//til bevægelse af kamera og for at registrere knapper der presses ned og slippes (smoothness xD )  
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});


function InitWebGL()
{

    canvas = document.getElementById('gl');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    //vi aktiverer webGL
    gl= document.getElementById('gl').getContext('webgl') ||
        document.getElementById('gl').getContext('experimental-webgl');

    if (!gl)
    {
        alert("WebGL is not supported by your browser.");
        return;
    }

    requestAnimationFrame(loop);
    
    setupJoystickControl();
    setupTouch();
    InitViewport();
    Update();
}

function InitViewport()
{
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.4, 0.6, 1.0); 
    gl.enable(gl.DEPTH_TEST); 
    gl.enable(gl.CULL_FACE); 
    gl.cullFace(gl.BACK); 

    InitShaders();
}

function InitShaders()
{

    const vertex = InitVertexShader();
    const fragment = InitFragmentShader();

    if (!vertex || !fragment) {
        console.error("Shader compile failed, skipping program creation.");
        return;
    }
    //
    let program = InitShaderProgram(vertex, fragment);

    if (!ValidateShaderProgram(program))
    {
        return false;
    }

    return CreateGeometryBuffers(program);
}

function InitVertexShader()
{
    let e = document.getElementById('vs')
    let vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, e.value);
    gl.compileShader(vs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
    {

        let e = gl.getShaderInfoLog(vs);
        console.error('Failed init vertex shader: ', e)
        return;
    }
    return vs;
}

function InitFragmentShader()
{
    let e = document.getElementById('fs')
    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, e.value);
    gl.compileShader(fs);


    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
    {

        let e = gl.getShaderInfoLog(fs);
        console.error('Failed init fragmentshader: ', e)
        return;
    }
    return fs;
}

//lav shader programmet (vs fs)
function InitShaderProgram(vs, fs)
{
    let p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    {

        console.error(gl.getProgramInfoLog(p));
        alert('Failed linking program');
        return;
    }
    return p;
}

function ValidateShaderProgram(p)
{
    gl.validateProgram(p)

    if (!gl.getProgramParameter(p, gl.VALIDATE_STATUS))
    {

        console.error(gl.getProgramInfoLog(p));
        alert('Errors found validating shader program');
        return false;
    }
    return true;
}

function CreateGeometryBuffers(program) 
{
    console.log("verticesModel før reset:", verticesModel.length);


    verticesModel.splice(0, verticesModel.length); //tømmer array men gemmer referencen til samme array 
    activeVertices = verticesModel;
    CreateGeometryUI();

    activeVertices = verticesGround; 
    CreateGroundGrid(50, 50, 50, 50, -2.0);

    //samler vertex-data til GPU og forbinder dem med shader programmets input
    vertices = verticesGround.concat(verticesModel);
    CreateVBO(program, new Float32Array(vertices));

    

    // --------------    shader program -------------------
    gl.useProgram(program); 

    angleGL = gl.getUniformLocation(program, 'Angle');
    viewGL  = gl.getUniformLocation(program, 'View');
    projectionGL = gl.getUniformLocation(program, 'Projection');
    modelGL = gl.getUniformLocation(program, 'Model');
    displayGL = gl.getUniformLocation(program, 'Display');
    twistGL = gl.getUniformLocation(program, 'Twist');
    normalMatrixGL = gl.getUniformLocation(program, 'NormalMatrix');
    lightDirGL = gl.getUniformLocation(program, 'LightDir');
    useLightingGL = gl.getUniformLocation(program, 'UseLighting');
    gl.uniform3fv(lightDirGL, [0.0, 0.0, -1.0]); 

    LoadTextures([
        'img/tekstur1.jpg',
        'img/tekstur2.jpg',
        'img/tekstur3.jpg',
        'img/tekstur4.jpg'
      ]);
    gl.uniform4fv(displayGL, new Float32Array(display));



    Render();

    console.log("Active program:", gl.getParameter(gl.CURRENT_PROGRAM));
}



function CreateVBO(program, vert) {
    mainVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vert, gl.STATIC_DRAW);

    const stride = 11 * Float32Array.BYTES_PER_ELEMENT;

    const locPos = gl.getAttribLocation(program, 'Pos');
    gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(locPos);

    const locColor = gl.getAttribLocation(program, 'Color');
    gl.vertexAttribPointer(locColor, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(locColor);

    const locUV = gl.getAttribLocation(program, 'UV');
    gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(locUV);

    const locNormal = gl.getAttribLocation(program, 'Normal');
    gl.vertexAttribPointer(locNormal, 3, gl.FLOAT, false, stride, 8 * 4);
    gl.enableVertexAttribArray(locNormal);

    ['Pos', 'Color', 'UV', 'Normal'].forEach(name => {
    const loc = gl.getAttribLocation(program, name);
    if (loc === -1) console.warn(`Attribute ${name} not found in shader.`);
});
}



function Render() {
    gl.clearColor(0.0, 0.2, 0.0, 0.5); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    const fov = Math.PI / 3;
    const aspect = gl.canvas.width / gl.canvas.height;
    const near = 0.1;
    const far = 100.0;

    const projectionMatrix = perspective(fov, aspect, near, far);
    gl.uniformMatrix4fv(projectionGL, false, new Float32Array(projectionMatrix));

    const viewMatrix = lookAtFromYawPitch(camera.position, camera.yaw, camera.pitch);
    gl.uniformMatrix4fv(viewGL, false, new Float32Array(viewMatrix));

    // const twistSlider = document.getElementById('twistSlider');
    // const twistValue = twistSlider ? parseFloat(twistSlider.value) : 0.0;
    // gl.uniform1f(twistGL, twistValue); 

    const checkbox = document.getElementById('showVertices');
    if (checkbox) showVertices = checkbox.checked; 

    //tegn normaler
    if (document.getElementById('showNormals')?.checked) {
    drawNormals();
}

    gl.bindTexture(gl.TEXTURE_2D, textures[currentTextureIndex]);

    const model = modelMatrix();
    //console.log("modelMatrix (raw):", model);
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(model));

    const normalMatrix = normalMatrixFromModelMatrix(model);
    //console.log("normal matrix:", normalMatrix.map(x => x.toFixed(2)));
    gl.uniformMatrix3fv(normalMatrixGL, false, new Float32Array(normalMatrix));

    const lightWorldDir = normalize([0, 0, 1]); 
    gl.uniform3fv(lightDirGL, lightWorldDir);

    drawGrid();
    drawModel();

    if (showVertices) drawVertices();
    
      if (!hasLogged) {
        console.log("Model vertices:", verticesModel.length / 11);
        console.log("Grid vertices:", verticesGround.length / 11);
        console.log("Total vertices:", vertices.length / 11);
        console.log("modelMatrix (raw):", model);
        hasLogged = true;
    }


}

function AddVertex( x, y, z, r, g, b, u, v, nx, ny, nz )
{
    //const index = vertices.length;

    const index = activeVertices.length;
    activeVertices.length += 11;
    activeVertices[index + 0] = x;
    activeVertices[index + 1] = y;
    activeVertices[index + 2] = z;
    activeVertices[index + 3] = r;
    activeVertices[index + 4] = g;
    activeVertices[index + 5] = b;
    activeVertices[index + 6] = u;
    activeVertices[index + 7] = v;
    activeVertices[index + 8] = nx;
    activeVertices[index + 9] = ny;
    activeVertices[index + 10] = nz;
}

function AddTriangle(x1, y1, z1, r1, g1, b1, u1, v1,
                     x2, y2, z2, r2, g2, b2, u2, v2,
                     x3, y3, z3, r3, g3, b3, u3, v3) {

    const p1 = [x1, y1, z1];
    const p2 = [x2, y2, z2];
    const p3 = [x3, y3, z3];

    const normal = computeNormal(p1, p2, p3);

    console.log("Normal for triangle:", normal);

    AddVertex(x1, y1, z1, r1, g1, b1, u1, v1, ...normal);
    AddVertex(x2, y2, z2, r2, g2, b2, u2, v2, ...normal);
    AddVertex(x3, y3, z3, r3, g3, b3, u3, v3, ...normal);
}


function AddQuad(x1, y1, z1, r1, g1, b1, u1, v1,
                 x2, y2, z2, r2, g2, b2, u2, v2,
                 x3, y3, z3, r3, g3, b3, u3, v3,
                 x4, y4, z4, r4, g4, b4, u4, v4)
{

    AddTriangle(x1, y1, z1, r1, g1, b1, u1, v1,
                x3, y3, z3, r3, g3, b3, u3, v3,
                x2, y2, z2, r2, g2, b2, u2, v2);


    AddTriangle(x1, y1, z1, r1, g1, b1, u1, v1,
                x4, y4, z4, r4, g4, b4, u4, v4,
                x3, y3, z3, r3, g3, b3, u3, v3);
}


function CreateTriangle(width, height, depth) {
    
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.0;

    AddTriangle( 0.0, h, d,    1.0, 0.0, 0.0,  0.5, 1.0,
                -w,  -h, d,    0.0, 1.0, 0.0,  0.0, 0.0,
                 w,  -h, d,    0.0, 0.0, 1.0,  1.0, 0.0); 
}

function CreateQuad(width, height, depth)
{
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.0;

    AddQuad(-w, h, d,   1.0, 0.0, 0.0,  0.0, 1.0,
         w, h, d,   1.0, 1.0, 0.0,  1.0, 1.0,
         w,-h, d,   0.0, 0.0, 1.0,  1.0, 0.0,
        -w,-h, d,   0.0, 1.0, 0.0,  0.0, 0.0);
}

//tester ()
function drawNormals() {
    const len = 0.2;
    const normalLines = [];

    for (let i = 0; i < verticesModel.length; i += 11) {
        const x = verticesModel[i];
        const y = verticesModel[i + 1];
        const z = verticesModel[i + 2];
        const nx = verticesModel[i + 8];
        const ny = verticesModel[i + 9];
        const nz = verticesModel[i + 10];

        const x2 = x + nx * len;
        const y2 = y + ny * len;
        const z2 = z + nz * len;

        // Start point (green)
        normalLines.push(x, y, z, 0.0, 1.0, 0.0); 
        // End point (green)
        normalLines.push(x2, y2, z2, 0.0, 1.0, 0.0);
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalLines), gl.STATIC_DRAW);

    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;

    const posLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'Pos');
    const colLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'Color');

    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(colLoc);

    // Brug samme modelMatrix for at matche objektets transformationer
    const model = modelMatrix();
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(model));

    // Slå tekstur og belysning fra for linjerne
    gl.uniform1i(useLightingGL, 0);
    gl.uniform4fv(displayGL, new Float32Array([0, 1, 0, 0]));

    gl.drawArrays(gl.LINES, 0, normalLines.length / 6);
}



function CreateBox(width, height, depth) {
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.5;

    const RED     = [1.0, 0.0, 0.0];
    const GREEN   = [0.0, 1.0, 0.0];
    const BLUE    = [0.0, 0.0, 1.0];
    const ORANGE  = [1.0, 0.5, 0.0];
    const PURPLE  = [0.5, 0.0, 0.5];
    const YELLOW  = [1.0, 1.0, 0.0];

    // Front face (Z+)
    AddQuadWithNormal(
        -w, -h,  d, ...RED,    0.0, 0.0,
        -w,  h,  d, ...RED,    0.0, 1.0,
         w,  h,  d, ...RED,    1.0, 1.0,
         w, -h,  d, ...RED,    1.0, 0.0,
         0, 0, 1 // normal
    );

    // Back face (Z-)
    AddQuadWithNormal(
         w, -h, -d, ...GREEN,  0.0, 0.0,
         w,  h, -d, ...GREEN,  0.0, 1.0,
        -w,  h, -d, ...GREEN,  1.0, 1.0,
        -w, -h, -d, ...GREEN,  1.0, 0.0,
         0, 0, -1 // normal
    );

    // Top face (Y+)
    AddQuadWithNormal(
        -w,  h,  d, ...BLUE,   0.0, 0.0,
        -w,  h, -d, ...BLUE,   0.0, 1.0,
         w,  h, -d, ...BLUE,   1.0, 1.0,
         w,  h,  d, ...BLUE,   1.0, 0.0,
         0, 1, 0 // normal
    );

    // Bottom face (Y-)
    AddQuadWithNormal(
        -w, -h, -d, ...ORANGE, 0.0, 0.0,
        -w, -h,  d, ...ORANGE, 0.0, 1.0,
         w, -h,  d, ...ORANGE, 1.0, 1.0,
         w, -h, -d, ...ORANGE, 1.0, 0.0,
         0, -1, 0 // normal
    );

    // Left face (X-)
    AddQuadWithNormal(
        -w, -h, -d, ...PURPLE, 0.0, 0.0,
        -w,  h, -d, ...PURPLE, 0.0, 1.0,
        -w,  h,  d, ...PURPLE, 1.0, 1.0,
        -w, -h,  d, ...PURPLE, 1.0, 0.0,
        -1, 0, 0 // normal
    );

    // Right face (X+)
    AddQuadWithNormal(
         w, -h,  d, ...YELLOW, 0.0, 0.0,
         w,  h,  d, ...YELLOW, 0.0, 1.0,
         w,  h, -d, ...YELLOW, 1.0, 1.0,
         w, -h, -d, ...YELLOW, 1.0, 0.0,
         1, 0, 0 // normal
    );
}


function CreateBlankBox(width, height, depth, color = [0.5, 0.5, 0.5])
{
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.5;

    AddQuad(-w, -h,  d, ...color, 0.0, 0.0,
             w, -h,  d, ...color, 1.0, 0.0,
             w,  h,  d, ...color, 1.0, 1.0,
            -w,  h,  d, ...color, 0.0, 1.0);

    AddQuad( w, -h, -d, ...color, 0.0, 0.0,
            -w, -h, -d, ...color, 1.0, 0.0,
            -w,  h, -d, ...color, 1.0, 1.0,
             w,  h, -d, ...color, 0.0, 1.0);

    AddQuad(-w,  h,  d, ...color, 0.0, 0.0,
             w,  h,  d, ...color, 1.0, 0.0,
             w,  h, -d, ...color, 1.0, 1.0,
            -w,  h, -d, ...color, 0.0, 1.0);

    AddQuad(-w, -h, -d, ...color, 0.0, 0.0,
             w, -h, -d, ...color, 1.0, 0.0,
             w, -h,  d, ...color, 1.0, 1.0,
            -w, -h,  d, ...color, 0.0, 1.0);

    AddQuad(-w, -h, -d, ...color, 0.0, 0.0,
            -w, -h,  d, ...color, 1.0, 0.0,
            -w,  h,  d, ...color, 1.0, 1.0,
            -w,  h, -d, ...color, 0.0, 1.0);

    AddQuad( w, -h,  d, ...color, 0.0, 0.0,
             w, -h, -d, ...color, 1.0, 0.0,
             w,  h, -d, ...color, 1.0, 1.0,
             w,  h,  d, ...color, 0.0, 1.0);
}



function AddQuadWithNormal(
    x1, y1, z1, r1, g1, b1, u1, v1,
    x2, y2, z2, r2, g2, b2, u2, v2,
    x3, y3, z3, r3, g3, b3, u3, v3,
    x4, y4, z4, r4, g4, b4, u4, v4,
    nx, ny, nz
) {
    AddVertex(x1, y1, z1, r1, g1, b1, u1, v1, nx, ny, nz);
    AddVertex(x3, y3, z3, r3, g3, b3, u3, v3, nx, ny, nz);
    AddVertex(x2, y2, z2, r2, g2, b2, u2, v2, nx, ny, nz);

    AddVertex(x1, y1, z1, r1, g1, b1, u1, v1, nx, ny, nz);
    AddVertex(x4, y4, z4, r4, g4, b4, u4, v4, nx, ny, nz);
    AddVertex(x3, y3, z3, r3, g3, b3, u3, v3, nx, ny, nz);
}

function CreateSubdividedBox(width, height, depth, divX, divY) {
    const dx = width / divX;
    const dy = height / divY;
    const dz = depth / divY;

    const x0 = -width / 2;
    const y0 = -height / 2;
    const z0 = depth / 2;

    const w = width / 2;
    const h = height / 2;

    function CreatePlane(divA, divB, origin, stepA, stepB, normal, invertOrder = false, flipUV = false) {
        const useLocalUVs = document.getElementById('localUVs')?.checked;

        for (let i = 0; i < divA; i++) {
            for (let j = 0; j < divB; j++) {
                const ax = origin[0] + i * stepA[0] + j * stepB[0];
                const ay = origin[1] + i * stepA[1] + j * stepB[1];
                const az = origin[2] + i * stepA[2] + j * stepB[2];

                const bx = ax + stepA[0];
                const by = ay + stepA[1];
                const bz = az + stepA[2];

                const dx_ = ax + stepB[0];
                const dy_ = ay + stepB[1];
                const dz_ = az + stepB[2];

                const cx = bx + stepB[0];
                const cy = by + stepB[1];
                const cz = bz + stepB[2];

                let u0, v0, u1, v1;

                if (useLocalUVs) {
                    u0 = 0;
                    v0 = 0;
                    u1 = 1;
                    v1 = 1;
                } else {
                    u0 = flipUV ? j / divB : i / divA;
                    v0 = flipUV ? i / divA : j / divB;
                    u1 = flipUV ? (j + 1) / divB : (i + 1) / divA;
                    v1 = flipUV ? (i + 1) / divA : (j + 1) / divB;
                }

                const color = (i + j) % 2 === 0 ? [0, 0.3, 0] : [0, 1, 0];

                if (!invertOrder) {
                    AddQuadWithNormal(
                        ax, ay, az, ...color, u0, v0,
                        bx, by, bz, ...color, u1, v0,
                        cx, cy, cz, ...color, u1, v1,
                        dx_, dy_, dz_, ...color, u0, v1,
                        ...normal
                    );
                } else {
                    AddQuadWithNormal(
                        ax, ay, az, ...color, u0, v0,
                        dx_, dy_, dz_, ...color, u1, v0,
                        cx, cy, cz, ...color, u1, v1,
                        bx, by, bz, ...color, u0, v1,
                        ...normal
                    );
                }
            }
        }
    }

    // Front (+Z)
    CreatePlane(divX, divY, [x0, y0,  z0], [dx, 0, 0], [0, dy, 0], [0, 0, 1], true, true);

    // Back (-Z)
    CreatePlane(divX, divY, [x0, y0, -z0], [dx, 0, 0], [0, dy, 0], [0, 0, -1], false, false);

    // Top (+Y)
    CreatePlane(divX, divY, [x0,  h, -z0], [dx, 0, 0], [0, 0, dz], [0, 1, 0], false, false);

    // Bottom (-Y)
    CreatePlane(divX, divY, [x0, -h, -z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], true, true);

    // Left (-X)
    CreatePlane(divY, divX, [-w, y0, -z0], [0, dy, 0], [0, 0, dz], [-1, 0, 0], false, false);

    // Right (+X)
    CreatePlane(divY, divX, [ w, y0,  z0], [0, dy, 0], [0, 0, -dz], [1, 0, 0], false, false);
}


function CreateGeometryUI() {

    const ew = document.getElementById('w');
    const w = ew? ew.value: 1.0;

    const eh = document.getElementById('h');
    const h = eh ? eh.value: 1.0;

    const ed = document.getElementById('d');
    const d = ed ? parseFloat(ed.value) : 1.0;


    let dx = document.getElementById('dx');
    let dy = document.getElementById('dy');

    const divX = dx ? parseInt(dx.value) : 8;
    const divY = dy ? parseInt(dy.value) : 8;



    document.getElementById('ui').innerHTML = `
    <b>Tools</b><br>
    <label class="checkbox-container">
      <input type="checkbox" id="showVertices" class="styled-checkbox"> Vis vertices
    </label><br>
  
    <label class="checkbox-container">
      <input type="checkbox" id="showLocalAxes"> Lokalt koordinatsystem
    </label><br><br>

    <label>Vælg tekstur:</label><br>
    <select id="textureSelect" onchange="ChangeTexture()">
      <option value="0">Tekstur 1</option>
      <option value="1">Tekstur 2</option>
      <option value="2">Tekstur 3</option>
      <option value="3">Tekstur 4</option>
    </select><br><br>

    <label class="checkbox-container">
      <input type="checkbox" id="t" class="styled-checkbox" onchange="Update();" checked> Vis tekstur
    </label><br><br>

    <label class="checkbox-container">
     <input type="checkbox" id="showNormals" class="styled-checkbox"> Vis normaler
    </label><br>


    <b>Twist Modifier</b><br>
    <label for="twistSlider">Twist:</label>
    <input type="range" id="twistSlider" min="-3" max="3" step="0.01" value="0" style="width: 200px;"><br><br>

    <label class="checkbox-container">
    <input type="checkbox" id="localUVs" class="styled-checkbox" onchange="UpdateUVMode();"> Lokal UV på subdivision
    </label><br><br>

    <label class="checkbox-container">
      Light Color:
      <input type="color" id="l" value="#f6b73c" onchange="Update();">
    </label><br><br>

    <b>Transformation</b><br>
  
    <div class="transform-grid">
      <div></div> <div>X</div> <div>Y</div> <div>Z</div>
  
      <div>Scale</div>
      <input type="number" id="scaleX" value="1.0" step="0.1" min="0.1">
      <input type="number" id="scaleY" value="1.0" step="0.1" min="0.1">
      <input type="number" id="scaleZ" value="1.0" step="0.1" min="0.1">
  
      <div>Rotate</div>
      <input type="number" id="rotX" value="0.0" step="1">
      <input type="number" id="rotY" value="0.0" step="1">
      <input type="number" id="rotZ" value="0.0" step="1">
  
      <div>Translate</div>
      <input type="number" id="transX" value="0.0" step="0.1">
      <input type="number" id="transY" value="0.0" step="0.1">
      <input type="number" id="transZ" value="0.0" step="0.1">
    </div><br>
  
    Shear XY: <input type="number" id="shXY" value="0.0" step="0.1"><br>
    Shear XZ: <input type="number" id="shXZ" value="0.0" step="0.1"><br>
  `;

    let e = document.getElementById('shape');
    switch(e.selectedIndex) {
        case 0: CreateTriangle(w, h, d); break;
        case 1: CreateQuad(w, h, d); break;
        case 2: CreateBlankBox(w, h, d); break; 
        case 3: CreateBox(w, h, d); break;
        case 4: CreateSubdividedBox(w, h, d, divX, divY); break;
    }


    
    [
        { id: 'scaleX', step: 0.01 },
        { id: 'scaleY', step: 0.01 },
        { id: 'scaleZ', step: 0.01 },
        { id: 'transX', step: 0.01 },
        { id: 'transY', step: 0.01 },
        { id: 'transZ', step: 0.01 },
        { id: 'shXY',   step: 0.01 },
        { id: 'shXZ',   step: 0.01 },
        { id: 'rotX',   step: 1.0 },
        { id: 'rotY',   step: 1.0 },
        { id: 'rotZ',   step: 1.0 }
    ].forEach(({ id, step }) => {
        const el = document.getElementById(id);
        if (el) makeInputDraggable(el, step);
    });
}




                                                                    //uv 

function ChangeTexture() {
    const select = document.getElementById('textureSelect');
    currentTextureIndex = parseInt(select.value);
}

function CreateTexture(prog, url) {

    const texture = LoadTexture(url);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    textureGL = gl.getUniformLocation(prog, 'Texture');

    displayGL = gl.getUniformLocation(prog, 'Display');
}

function LoadTexture(url) {

    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);

    const pixel = new Uint8Array([0, 0, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, 
gl.RGBA, gl.UNSIGNED_BYTE, pixel);
   const image = new Image();
   image.onload = () => {
       gl.bindTexture(gl.TEXTURE_2D, texture);
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
       SetTextureFilters(image);
    };
    image.src = url;
    return texture;
}

function LoadTextures(urls) {
    textures = urls.map(url => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        const pixel = new Uint8Array([0, 0, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        const img = new Image();
        img.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            SetTextureFilters(img);
        };
        img.src = url;

        return tex;
    });
}

function SetTextureFilters(image) {

    if (IsPow2(image.width) && IsPow2(image.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
    }
    else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
}
    
function IsPow2(value) {
    return(value & (value -1)) === 0;
}

function Update() {

    const t = document.getElementById('t');
    display[3] = t.checked ? 1.0 : 0.0;

     const l = document.getElementById('l');
    if (l && l.value.startsWith('#') && l.value.length === 7) {
        display[0] = parseInt(l.value.substring(1, 3), 16) / 255.0;
        display[1] = parseInt(l.value.substring(3, 5), 16) / 255.0;
        display[2] = parseInt(l.value.substring(5, 7), 16) / 255.0;
    }

    
    gl.uniform4fv(displayGL, new Float32Array(display));
    Render();
}




function drawModel() {

    gl.uniform1i(useLightingGL, 1);

    const matrix = modelMatrix();
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(matrix));

    // const shapeType = document.getElementById('shape').selectedIndex;
    // if (shapeType === 0 || shapeType === 1) { 
    //     gl.disable(gl.CULL_FACE);
    // } else {
    //     gl.enable(gl.CULL_FACE);
    //     gl.cullFace(gl.BACK); 
    // }


    if (document.getElementById('showLocalAxes')?.checked) {
        drawLocalAxes(matrix);
    }
    

    gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
    const stride = 11 * Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(1);
    

    const groundVerticesCount = verticesGround.length / 11;
    gl.drawArrays(gl.TRIANGLES, groundVerticesCount, verticesModel.length / 11);


}

function drawVertices() {
    const matrix = modelMatrix();
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(matrix));

    const vertexCount = verticesModel.length / 11;
    const groundCount = verticesGround.length / 11;
    const first = groundCount;

    gl.drawArrays(gl.POINTS, first, vertexCount);
}


function drawLocalAxes(modelMatrix) {
    const savedBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const savedProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const savedDisplay = display.slice();
    const savedUseLighting = gl.getUniform(savedProgram, useLightingGL);

    // Lav ny buffer til akser
    const axisVertices = [
        // X-akse (rød)
        0, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
        // Y-akse (grøn)
        0, 0, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 0,
        // Z-akse (blå)
        0, 0, 0, 0, 0, 1,
        0, 0, 1, 0, 0, 1
    ];
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axisVertices), gl.STATIC_DRAW);

    // Bruger kun Pos og Color (ingen UV, Normal her)
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    const posLoc = gl.getAttribLocation(savedProgram, 'Pos');
    const colLoc = gl.getAttribLocation(savedProgram, 'Color');

    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(colLoc);

    // Deaktiver lys og tekstur for akselinjer
    gl.uniform1i(useLightingGL, 0);
    gl.uniform4fv(displayGL, new Float32Array([0, 0, 0, 0]));

    gl.uniformMatrix4fv(modelGL, false, new Float32Array(modelMatrix));
    gl.drawArrays(gl.LINES, 0, 6);

    // 💡 Gendan tidligere buffer og uniforms
    gl.bindBuffer(gl.ARRAY_BUFFER, savedBuffer);
    gl.uniform4fv(displayGL, new Float32Array(savedDisplay));
    gl.uniform1i(useLightingGL, savedUseLighting);
}




//                                     matricer

function modelMatrix() {
    //Scale
    const sx = parseInputFloat('scaleX', 1);
    const sy = parseInputFloat('scaleY', 1);
    const sz = parseInputFloat('scaleZ', 1);

    //Translation
    const tx = parseInputFloat('transX', 0);
    const ty = parseInputFloat('transY', 0);
    const tz = parseInputFloat('transZ', 0);

    //Shear
    const shXY = parseInputFloat('shXY', 0);
    const shXZ = parseInputFloat('shXZ', 0);

    //Rotation (konverteret til radianer)
    const rx = parseInputFloat('rotX', 0) * Math.PI / 180;
    const ry = parseInputFloat('rotY', 0) * Math.PI / 180;
    const rz = parseInputFloat('rotZ', 0) * Math.PI / 180;

    const scaleMatrix = scalingMatrix(sx, sy, sz);
    const shearMatrixLocal = shearMatrix(shXY, shXZ, 0, 0, 0, 0);
    const rotX = rotationXMatrix(rx);
    const rotY = rotationYMatrix(ry);
    const rotZ = rotationZMatrix(rz);
    const translateMatrix = translationMatrix(tx, ty, tz);

    let modelMatrix = identityMatrix();
    modelMatrix = multiply4x4(modelMatrix, scaleMatrix);
    modelMatrix = multiply4x4(modelMatrix, shearMatrixLocal);
    modelMatrix = multiply4x4(modelMatrix, rotX);
    modelMatrix = multiply4x4(modelMatrix, rotY);
    modelMatrix = multiply4x4(modelMatrix, rotZ);
    modelMatrix = multiply4x4(modelMatrix, translateMatrix);

    return modelMatrix;
}



//projectionMatrix
function perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);

    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, 2 * near * far * rangeInv, 0
    ];
}


//viewMatrix
function lookAtFromYawPitch(position, yaw, pitch) {

    //funktioner til at finde tallene i vektoren 
                                                 //feks. kigge direkte op 
    const cosPitch = Math.cos(pitch);            //Math.sin(pitch) = 1
    const sinPitch = Math.sin(pitch);            //Math.cos(pitch) = 0

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    //vektoren der afgører retning kameraet vender, altså -Z akse
    const forward = [ 
        cosPitch * sinYaw,                       //x
        sinPitch,                                //y
        -cosPitch * cosYaw                       //z
    ];

    //vektoren der afgører retning af x aksen 
    const right = normalize([
        Math.cos(yaw),
        0,
        Math.sin(yaw)
    ]);


    //up vektoren - vi sikrer at alle tre akser (right, up, forward) er et ortogonalt koordinatsystem
    const up = normalize(cross(right, forward));   

    return [
        //x           //y                             //z
        right[0],    up[0],                        -forward[0],            0,
        right[1],    up[1],                        -forward[1],            0,
        right[2],    up[2],                        -forward[2],            0,

        -dot(right, position), -dot(up, position), dot(forward, position), 1
        //for at lave matrixmultiplikationen finder vi prikpunktet af kameraets lokale koordinater og kameraets position 
    ];
}

//rotationsMatrix
function rotationXMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        1,  0,  0,  0,
        0,  c,  s,  0,
        0, -s,  c,  0,
        0,  0,  0,  1
    ];
}

function rotationYMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ];
}

function rotationZMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

function scalingMatrix(sx, sy, sz) {
    return [
        sx, 0,  0,  0,
        0,  sy, 0,  0,
        0,  0,  sz, 0,
        0,  0,  0,  1
    ];
}

function translationMatrix(tx, ty, tz) {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        tx, ty, tz, 1
    ];
}

function shearMatrix(shXY, shXZ, shYX, shYZ, shZX, shZY) {
    return [
        1, shYX, shZX, 0,
        shXY, 1, shZY, 0,
        shXZ, shYZ, 1, 0,
        0, 0, 0, 1
    ];
}

function extractMat3FromMat4(m) {
    return [
        m[0], m[1], m[2],
        m[4], m[5], m[6],
        m[8], m[9], m[10]
    ];
}

function inverseMat3(m) {
    const a = m[0], b = m[1], c = m[2],
          d = m[3], e = m[4], f = m[5],
          g = m[6], h = m[7], i = m[8];

    const A = e * i - f * h;
    const B = -(d * i - f * g);
    const C = d * h - e * g;
    const D = -(b * i - c * h);
    const E = a * i - c * g;
    const F = -(a * h - b * g);
    const G = b * f - c * e;
    const H = -(a * f - c * d);
    const I = a * e - b * d;

    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-6) return identityMat3();

    const invDet = 1.0 / det;
    return [
        A * invDet, D * invDet, G * invDet,
        B * invDet, E * invDet, H * invDet,
        C * invDet, F * invDet, I * invDet
    ];
}

function transposeMat3(m) {
    return [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8]
    ];
}

function identityMat3() {
    return [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ];
}

function identityMatrix() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

function multiplyMat3ByVec3(m, v) {
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
}




//                                   bevægelse (viewMatrix)
function UpdateCamera(dt) {

    const speed = 4.0;
    const velocity = speed * dt;

    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);

    const forward = normalize([
        cosPitch * sinYaw,
        sinPitch, 
        -cosPitch * cosYaw
    ]);

    const right = normalize([
        Math.cos(camera.yaw),
        0,
        Math.sin(camera.yaw)
    ]);

    if (keys[' ']) { 
        camera.position[1] += velocity;
    }
    if (keys['shift']) {
        camera.position[1] -= velocity;
    }

    if (keys['w']) camera.position = camera.position.map((v, i) => v + forward[i] * velocity);
    if (keys['s']) camera.position = camera.position.map((v, i) => v - forward[i] * velocity);
    if (keys['a']) camera.position = camera.position.map((v, i) => v - right[i] * velocity);
    if (keys['d']) camera.position = camera.position.map((v, i) => v + right[i] * velocity);

    if (joystickState.active) {
        const forward = normalize([
            Math.cos(camera.pitch) * Math.sin(camera.yaw),
            Math.sin(camera.pitch),
            -Math.cos(camera.pitch) * Math.cos(camera.yaw)
        ]);
    
        const right = normalize([
            Math.cos(camera.yaw),
            0,
            Math.sin(camera.yaw)
        ]);

        const dx = joystickState.direction[0];
        const dy = joystickState.direction[1];
    
        for (let i = 0; i < 3; i++) {
            camera.position[i] += right[i] * dx * velocity;
            camera.position[i] += -forward[i] * dy * velocity;
        }
    }
}

let lastTime = performance.now();

function loop(currentTime) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    UpdateCamera(dt);
    Render();

    requestAnimationFrame(loop);
}

function UpdateUVMode() {
    hasLogged = false;

    const shapeType = document.getElementById('shape').selectedIndex;
    if (shapeType === 4) {  

        verticesModel.splice(0, verticesModel.length);
        activeVertices = verticesModel;

        //genskab modellen/figuren
        const ew = document.getElementById('w');
        const w = ew ? parseFloat(ew.value) : 1.0;

        const eh = document.getElementById('h');
        const h = eh ? parseFloat(eh.value) : 1.0;

        const ed = document.getElementById('d');
        const d = ed ? parseFloat(ed.value) : 1.0;

        const dx = document.getElementById('dx');
        const dy = document.getElementById('dy');
        const divX = dx ? parseInt(dx.value) : 8;
        const divY = dy ? parseInt(dy.value) : 8;

        CreateSubdividedBox(w, h, d, divX, divY);

        vertices = verticesGround.concat(verticesModel);

        gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        Render();
    } else {
        console.log("Local UVs virker kun på subdivided box.");
    }
}


//                                        hjælpefunktioner
//enhedsvektor
function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(val => val / len);
}

//krydsproduktet
function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

//prikproduktet 
function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

//matrixmultiplikation
function multiply4x4(a, b) {
    const out = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                out[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
            }
        }
    }
    return out;
}

//tester ------------
function normalMatrixFromModelMatrix(model) {
    const m3 = extractMat3FromMat4(model);
    const inv = inverseMat3(m3);
    return inv ? transposeMat3(inv) : identityMat3();
}

function parseInputFloat(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const raw = el.value.replace(',', '.');
    const val = parseFloat(raw);
    return isNaN(val) ? fallback : val;
}
//tester ----------------------


function computeNormal(p1, p2, p3) {
    const u = [
        p2[0] - p1[0],
        p2[1] - p1[1],
        p2[2] - p1[2]
    ];
    const v = [
        p3[0] - p1[0],
        p3[1] - p1[1],
        p3[2] - p1[2]
    ];
    const normal = cross(u, v);
    return normalize(normal);
}




//                                    grid

//en enkelt linje (bræddet)
function AddGridLine(x1, y1, z1, x2, y2, z2, r, g, b) {
    const u = 0.0, v = 0.0;
    const nx = 0.0, ny = 1.0, nz = 0.0;

    AddVertex(x1, y1, z1, r, g, b, nx, ny, nz);
    AddVertex(x2, y2, z2, r, g, b, nx, ny, nz);
}

//hele grid (hele gulvet af brædder) 
function CreateGroundGrid(width, depth, divX, divZ, yOffset = -0.5) {
    const dx = width / divX;
    const dz = depth / divZ;

    const x0 = -width / 2;
    const z0 = -depth / 2;

    const color = [0.0, 1.0, 0.0];

    for (let i = 0; i <= divX; i++) {
        const x = x0 + i * dx;
        AddGridLine(x, yOffset, z0, x, yOffset, z0 + depth, ...color);
    }

    for (let j = 0; j <= divZ; j++) {
        const z = z0 + j * dz;
        AddGridLine(x0, yOffset, z, x0 + width, yOffset, z, ...color);
    }
}

//bed GPU'en om at gøre grid statisk
function drawGrid() {

    gl.uniform1i(useLightingGL, 0);

    //fjern teksturen 
    gl.uniform4fv(displayGL, new Float32Array([0, 1, 0, 0]));

    //deaktiver bend
    gl.uniform1f(twistGL, 0.0);

    //for modellen 
    const identityMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(identityMatrix));

    gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
    const stride = 11 * Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    const groundVerticesCount = verticesGround.length / 11;
    gl.drawArrays(gl.LINES, 0, groundVerticesCount);

    //genskab bend og display state bagefter
    const t = document.getElementById('t');
    const displayVal = t.checked ? 1.0 : 0.0;
    gl.uniform4fv(displayGL, new Float32Array([0, 0, 0, displayVal]));

    //genaktiver bend efter grid (for modellen)
    const twistSlider = document.getElementById('twistSlider');
    const twistValue = twistSlider ? parseFloat(twistSlider.value) : 0.0;
    gl.uniform1f(twistGL, twistValue);
}



























//                         mouse

let mouseX = 0;
let mouseY = 0;

document.getElementById('gl').addEventListener('mousemove', function (e) {
    if (e.buttons === 1) { 
        const dx = e.movementX || e.mozMovementX || e.webkitMovementX || (e.x - mouseX);
        const dy = e.movementY || e.mozMovementY || e.webkitMovementY || (e.y - mouseY);


        const sensitivity = 0.002;

        camera.yaw   += dx * sensitivity;
        camera.pitch -= dy * sensitivity;


        const maxPitch = Math.PI / 2 - 0.01;
        camera.pitch = Math.max(-maxPitch, Math.min(maxPitch, camera.pitch));
    }

    mouseX = e.x;
    mouseY = e.y;
});

 //                      sørger for du kan scroll input med musseklik
function makeInputDraggable(input, step = 0.1) {
    let dragging = false;
    let lastY = 0;

    input.addEventListener('mousedown', (e) => {
        dragging = true;
        lastY = e.clientY;
        e.preventDefault();
        input.style.cursor = 'ns-resize';

   
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (dragging) {
            const delta = e.movementY; 
            let current = parseFloat(input.value) || 0;
            let min = parseFloat(input.min) || -Infinity;
            let max = parseFloat(input.max) || Infinity;

            let newValue = current - delta * step;
            newValue = Math.max(min, Math.min(max, newValue));

            input.value = newValue.toFixed(2);
            input.dispatchEvent(new Event('input'));
        }
    });

    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            input.style.cursor = 'auto';

            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        }
    });
}


                                   //bevægelse på mobil (indsæt justering af transformationer)
                                                                
let joystickState = {
    active: false,
    angle: 0,
    distance: 0,
    direction: [0, 0]
};

function setupTouch() {
    let lastTouchX = null;
    let lastTouchY = null;
    let rotationX = 0;
    let rotationY = 0;

    const touchSensitivity = 0.005;

    let lastDistance = null;
    let zoom = 1.0;

    function isInJoystickArea(touch) {
        const rect = document.getElementById("joystick-container").getBoundingClientRect();
        return (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        );
    }

    canvas.addEventListener('touchstart', (e) => {
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (!isInJoystickArea(t)) {
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
                break;
            }
        }
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
    
        const touch = e.touches[0];
        if (isInJoystickArea(touch)) {
        return; 
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - lastTouchX;
            const dy = touch.clientY - lastTouchY;
    
            rotationX += dx * touchSensitivity;
            rotationY += dy * touchSensitivity;
    
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
    
            updateRotation(rotationX, rotationY);
        }
    
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
    
            if (lastDistance !== null) {
                const delta = distance - lastDistance;
                zoom += delta * 0.01;
                zoom = Math.max(0.1, Math.min(zoom, 5.0));
    
                updateZoom(zoom);
            }
    
            lastDistance = distance;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        lastDistance = null;
    });

    function updateRotation(rotX, rotY) {
        camera.yaw = rotX;

        const maxPitch = Math.PI / 2 - 0.01;
        camera.pitch = Math.max(-maxPitch, Math.min(maxPitch, -rotY));
    }

    function updateZoom(zoomLevel) {

        const forward = normalize([
            Math.cos(camera.pitch) * Math.sin(camera.yaw),
            Math.sin(camera.pitch),
            -Math.cos(camera.pitch) * Math.cos(camera.yaw)
        ]);

        camera.position = [
            forward[0] * -zoomLevel,
            forward[1] * -zoomLevel,
            forward[2] * -zoomLevel
        ];
    }
}

function setupJoystickControl() {
    const container = document.getElementById("joystick-container");
    const handle = document.getElementById("joystick-handle");
    const center = { x: container.offsetWidth / 2, y: container.offsetHeight / 2 };

    container.addEventListener("touchstart", e => {
        joystickState.active = true;
    });

    container.addEventListener("touchmove", e => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const dx = x - center.x;
        const dy = y - center.y;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40); 

        const angle = Math.atan2(dy, dx);
        joystickState.angle = angle;
        joystickState.distance = distance;
        joystickState.direction = [Math.cos(angle), Math.sin(angle)];

        handle.style.left = `${center.x + Math.cos(angle) * distance - 25}px`;
        handle.style.top = `${center.y + Math.sin(angle) * distance - 25}px`;
    }, { passive: false });

    container.addEventListener("touchend", () => {
        joystickState.active = false;
        joystickState.direction = [0, 0];
        handle.style.left = "35px";
        handle.style.top = "35px";
    });

}