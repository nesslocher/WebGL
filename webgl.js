var gl;
var vertices = [];
var viewGL = 0;
let activeVertices = vertices;
let showVertices = false;
let mainVBO = null;

let hasLogged = false;
let canvas;
let faceList = []; 

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

    requestAnimationFrame(loop);


    gl= document.getElementById('gl').getContext('webgl') ||
        document.getElementById('gl').getContext('experimental-webgl');

    if (!gl)
    {
        alert("WebGL is not supported by your browser.");
        return;
    }

    canvas = document.getElementById('gl');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;


    //markering af face (overhovedet ikke optimal ==>  find ud af hvad problemet er med ray cast)
    canvas.addEventListener('click', (e) => {
        const mouseX = (e.clientX / canvas.width) * 2 - 1;
        const mouseY = 1 - (e.clientY / canvas.height) * 2;
    
        const inverseViewProj = inverseMatrix4x4(
            multiply4x4(
                lookAtFromYawPitch(camera.position, camera.yaw, camera.pitch),
                perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100)
            )
        );
        
    
        const rayStart = unproject([mouseX, mouseY, -1], inverseViewProj);
        const rayEnd   = unproject([mouseX, mouseY,  1], inverseViewProj);
    
        const rayDir = normalize([
            rayEnd[0] - rayStart[0],
            rayEnd[1] - rayStart[1],
            rayEnd[2] - rayStart[2]
        ]);
    
        for (let face of faceList) {
            if (rayIntersectsQuad(rayStart, rayDir, face.vertices)) {
                face.selected = !face.selected; 
                vertices = verticesGround.concat(verticesModel);
                CreateVBO(gl.getParameter(gl.CURRENT_PROGRAM), new Float32Array(vertices)); 
                console.log("Face selected:", face);
                break;
            }
        }
    });
    
    setupJoystickControl();
    setupTouch();
    InitViewport();

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

function CreateGeometryBuffers(program) {

    verticesGround = [];
    verticesModel = [];
    faceList = [];

    console.log("verticesModel før reset:", verticesModel.length);

    verticesModel.splice(0, verticesModel.length);
    activeVertices = verticesModel;
    CreateGeometryUI();

    activeVertices = verticesGround; 
    CreateGroundGrid(50, 50, 50, 50, -2.0);

    

    vertices = verticesGround.concat(verticesModel);
    CreateVBO(program, new Float32Array(vertices));

    gl.useProgram(program); 

    angleGL = gl.getUniformLocation(program, 'Angle');
    viewGL  = gl.getUniformLocation(program, 'View');
    projectionGL = gl.getUniformLocation(program, 'Projection');
    modelGL = gl.getUniformLocation(program, 'Model');
    

    Render();
}



function CreateVBO(program, vert)
{
    mainVBO = gl.createBuffer();
    let vbo = mainVBO;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vert, gl.STATIC_DRAW);
    const s = 6 * Float32Array.BYTES_PER_ELEMENT; 
    

    let p= gl.getAttribLocation(program, 'Pos');
    gl.vertexAttribPointer(p, 3, gl.FLOAT, gl.FALSE, s, 0); 
    gl.enableVertexAttribArray(p);

    const o = 3 * Float32Array.BYTES_PER_ELEMENT; 
    let c = gl.getAttribLocation(program, 'Color');
    gl.vertexAttribPointer(c, 3, gl.FLOAT, gl.FALSE, s, o);
    gl.enableVertexAttribArray(c); 
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


    //vertex tool
    const checkbox = document.getElementById('showVertices');
    if (checkbox) showVertices = checkbox.checked; 

    
    if (!hasLogged) {
        console.log("Model vertices:", verticesModel.length / 6);
        console.log("Grid vertices:", verticesGround.length / 6);
        console.log("Total vertices:", vertices.length / 6);
        hasLogged = true;
    }
    
    drawGrid();
    drawModel();
    if (showVertices) drawVertices();

    //vi bruger gl.useProgram(program) i CreateGeometryBuffers() 
    //gl.useProgram(gl.getParameter(gl.CURRENT_PROGRAM));
}

function AddVertex(x,y,z,r,g,b)
{
    //const index = vertices.length;
    const index = activeVertices.length;
    activeVertices.length += 6;
    activeVertices[index + 0] = x;
    activeVertices[index + 1] = y;
    activeVertices[index + 2] = z;
    activeVertices[index + 3] = r;
    activeVertices[index + 4] = g;
    activeVertices[index + 5] = b;
}

function AddTriangle(x1,y1,z1,r1,g1,b1,
                     x2,y2,z2,r2,g2,b2,
                     x3,y3,z3,r3,g3,b3
)
{
    AddVertex(x1,y1,z1,r1,g1,b1);
    AddVertex(x2,y2,z2,r2,g2,b2);
    AddVertex(x3,y3,z3,r3,g3,b3);
}

function AddQuad(x1, y1, z1,   r1,g1,b1,
                 x2, y2, z2,   r2,g2,b2,
                 x3, y3, z3,   r3,g3,b3,
                 x4, y4, z4,   r4,g4,b4)
             {
         AddTriangle(x1, y1, z1, r1, g1, b1,
                     x2, y2, z2, r2, g2, b2,
                     x3, y3, z3, r3, g3, b3);

         AddTriangle(x1, y1, z1, r1, g1, b1, 
                     x3, y3, z3, r3, g3, b3,
                     x4, y4, z4, r4, g4, b4);   
                     
        faceList.push({
            vertices: [
                [x1, y1, z1],
                [x2, y2, z2],
                [x3, y3, z3],
                [x4, y4, z4]
            ],
            selected: false
        });
    }

function CreateTriangle(width, height, depth) {
    
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.0;

    AddTriangle( 0.0, h, d,    1.0, 0.0, 0.0,
                -w,  -h, d,    0.0, 1.0, 0.0,
                 w,  -h, d,    0.0, 0.0, 1.0); 
}

function CreateQuad(width, height, depth)
{
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.0;

    AddQuad(-w, h, d,   1.0, 0.0, 0.0,
            -w,-h, d,   0.0, 1.0, 0.0,
             w,-h, d,   0.0, 0.0, 1.0,
             w, h, d,   1.0, 1.0, 0.0);
}


function CreateBox(width, height, depth)
{

    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.5;

    //kig på farvekoderne
    const RED     = [1.0, 0.0, 0.0];
    const GREEN   = [0.0, 1.0, 0.0];
    const BLUE    = [0.0, 0.0, 1.0];
    const ORANGE  = [1.0, 0.5, 0.0];
    const PURPLE  = [0.5, 0.0, 0.5];
    const YELLOW  = [1.0, 1.0, 0.0];

    //Z positiv
    AddQuad(-w, -h,  d, ...RED,
             w, -h,  d, ...RED,
             w,  h,  d, ...RED,
            -w,  h,  d, ...RED);

    //Z negativ
    AddQuad( w, -h, -d, ...GREEN,
            -w, -h, -d, ...GREEN,
            -w,  h, -d, ...GREEN,
             w,  h, -d, ...GREEN);

    //Y positiv
    AddQuad(-w,  h,  d, ...BLUE,
             w,  h,  d, ...BLUE,
             w,  h, -d, ...BLUE,
            -w,  h, -d, ...BLUE);

    //Y -
    AddQuad(-w, -h, -d, ...ORANGE,
             w, -h, -d, ...ORANGE,
             w, -h,  d, ...ORANGE,
            -w, -h,  d, ...ORANGE);

    //X + 
    AddQuad(-w, -h, -d, ...PURPLE,
            -w, -h,  d, ...PURPLE,
            -w,  h,  d, ...PURPLE,
            -w,  h, -d, ...PURPLE);

    //X -
    AddQuad( w, -h,  d, ...YELLOW,
             w, -h, -d, ...YELLOW,
             w,  h, -d, ...YELLOW,
             w,  h,  d, ...YELLOW);
}

function CreateBlankBox(width, height, depth, color = [0.5, 0.5, 0.5])
{
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.5;

    AddQuad(-w, -h,  d, ...color,
             w, -h,  d, ...color,
             w,  h,  d, ...color,
            -w,  h,  d, ...color);

    AddQuad( w, -h, -d, ...color,
            -w, -h, -d, ...color,
            -w,  h, -d, ...color,
             w,  h, -d, ...color);

    AddQuad(-w,  h,  d, ...color,
             w,  h,  d, ...color,
             w,  h, -d, ...color,
            -w,  h, -d, ...color);

    AddQuad(-w, -h, -d, ...color,
             w, -h, -d, ...color,
             w, -h,  d, ...color,
            -w, -h,  d, ...color);

    AddQuad(-w, -h, -d, ...color,
            -w, -h,  d, ...color,
            -w,  h,  d, ...color,
            -w,  h, -d, ...color);

    AddQuad( w, -h,  d, ...color,
             w, -h, -d, ...color,
             w,  h, -d, ...color,
             w,  h,  d, ...color);
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

    function CreatePlane(divA, divB, origin, stepA, stepB, invertOrder = false) {
        for (let i = 0; i < divA; i++) {
            for (let j = 0; j < divB; j++) {
                const ax = origin[0] + i * stepA[0] + j * stepB[0];
                const ay = origin[1] + i * stepA[1] + j * stepB[1];
                const az = origin[2] + i * stepA[2] + j * stepB[2];

                const bx = ax + stepA[0];
                const by = ay + stepA[1];
                const bz = az + stepA[2];

                const dx = ax + stepB[0];
                const dy = ay + stepB[1];
                const dz = az + stepB[2];

                const cx = bx + stepB[0];
                const cy = by + stepB[1];
                const cz = bz + stepB[2];

                const color = (i + j) % 2 === 0 ? [0, 0.3, 0] : [0, 1, 0];

                if (!invertOrder) {
                    AddQuad(ax, ay, az, ...color,
                            bx, by, bz, ...color,
                            cx, cy, cz, ...color,
                            dx, dy, dz, ...color);
                } else {
                    AddQuad(ax, ay, az, ...color,
                            dx, dy, dz, ...color,
                            cx, cy, cz, ...color,
                            bx, by, bz, ...color);
                }
            }
        }
    }

    //bund
    CreatePlane(divX, divY, [x0, y0,  z0], [dx, 0, 0], [0, dy, 0], false);

    //bagsiden
    CreatePlane(divX, divY, [x0, y0, -z0], [dx, 0, 0], [0, dy, 0], true);

    //top
    CreatePlane(divX, divY, [x0,  h, -z0], [dx, 0, 0], [0, 0, dz], true);

    //front
    CreatePlane(divX, divY, [x0, -h, -z0], [dx, 0, 0], [0, 0, dz], false);

    //venstre
    CreatePlane(divX, divY, [-w, y0, -z0], [0, dy, 0], [0, 0, dz], true);

    //højre(+X)
    CreatePlane(divX, divY, [ w, y0, -z0], [0, dy, 0], [0, 0, dz], false);
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



    document.getElementById('ui').innerHTML =

    '<b>Tools</b><br>' +
    '<label class="checkbox-container">' +
    '<input type="checkbox" id="showVertices" class="styled-checkbox"> Vis vertices' +
    '</label><br>' +

    '<label class="checkbox-container">' +
    '<input type="checkbox" id="showLocalAxes"> Lokalt koordinatsystem<br><br>' +
    '</label><br>' +

    '<b>Transformation</b><br>' +
    'Scale X: <input type="number" id="scaleX" value="1.0" step="0.1" min="0.1"><br>' +
    'Scale Y: <input type="number" id="scaleY" value="1.0" step="0.1" min="0.1"><br>' +
    'Scale Z: <input type="number" id="scaleZ" value="1.0" step="0.1" min="0.1"><br><br>' +

    'Rotate X: <input type="number" id="rotX" value="0.0" step="1"><br>' +
    'Rotate Y: <input type="number" id="rotY" value="0.0" step="1"><br>' +
    'Rotate Z: <input type="number" id="rotZ" value="0.0" step="1"><br><br>' +

    'Translate X: <input type="number" id="transX" value="0.0" step="0.1"><br>' +
    'Translate Y: <input type="number" id="transY" value="0.0" step="0.1"><br>' +
    'Translate Z: <input type="number" id="transZ" value="0.0" step="0.1"><br><br>' +

    'Shear XY: <input type="number" id="shXY" value="0.0" step="0.1"><br>' +
    'Shear XZ: <input type="number" id="shXZ" value="0.0" step="0.1"><br>';



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







//bevægelsesfunktion /copy viewMatrix
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

    // if (keys['w']) {
    //     camera.position[0] += forward[0] * velocity;
    //     camera.position[1] += forward[1] * velocity;
    //     camera.position[2] += forward[2] * velocity;
    // }
    // if (keys['s']) {
    //     camera.position[0] -= forward[0] * velocity;
    //     camera.position[1] -= forward[1] * velocity;
    //     camera.position[2] -= forward[2] * velocity;
    // }
    // if (keys['a']) {
    //     camera.position[0] -= right[0] * velocity;
    //     camera.position[1] -= right[1] * velocity;
    //     camera.position[2] -= right[2] * velocity;
    // }
    // if (keys['d']) {
    //     camera.position[0] += right[0] * velocity;
    //     camera.position[1] += right[1] * velocity;
    //     camera.position[2] += right[2] * velocity;
    // }

   
}

let lastTime = performance.now();

function loop(currentTime) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    UpdateCamera(dt);
    Render();

    requestAnimationFrame(loop);
}

function drawLocalAxes(modelMatrix) {

    //de starter alle i 0,0,0 og derefter bevæg dig ud i de henholdvise akser 
    const axisVertices = [  
        0, 0, 0,    1, 0, 0,
        1, 0, 0,    1, 0, 0, 

        0, 0, 0,    0, 1, 0,
        0, 1, 0,    0, 1, 0,
        
        0, 0, 0,    0, 0, 1,
        0, 0, 1,    0, 0, 1,
    ];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axisVertices), gl.STATIC_DRAW);

    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    const offsetColor = 3 * Float32Array.BYTES_PER_ELEMENT;

    const posLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'Pos');
    const colLoc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'Color');

    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, offsetColor);
    gl.enableVertexAttribArray(colLoc);

    gl.uniformMatrix4fv(modelGL, false, new Float32Array(modelMatrix));
    gl.drawArrays(gl.LINES, 0, 6);

}

function drawVertices() {
    const matrix = modelMatrix();
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(matrix));

    const vertexCount = verticesModel.length / 6;
    const groundCount = verticesGround.length / 6;
    const first = groundCount;

    gl.drawArrays(gl.POINTS, first, vertexCount);
}





                                                     //matricer


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
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
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

//inverseMatrix til håndtering af modsat projectionMatrix (ray cast)  den er bare midlertidig    -      undersøg det lidt nærmere, matematisk 
function inverseMatrix4x4(m) {
    const mat = new DOMMatrix([...m]);
    const inv = mat.inverse();
    return [
        inv.m11, inv.m12, inv.m13, inv.m14,
        inv.m21, inv.m22, inv.m23, inv.m24,
        inv.m31, inv.m32, inv.m33, inv.m34,
        inv.m41, inv.m42, inv.m43, inv.m44
    ];
}


function unproject(screenPos, invViewProjMatrix) {
    const [x, y, z] = screenPos;
    const vec = [
        x,
        y,
        z,
        1.0
    ];

    
    const out = [
        vec[0] * invViewProjMatrix[0]  + vec[1] * invViewProjMatrix[4]  + vec[2] * invViewProjMatrix[8]  + vec[3] * invViewProjMatrix[12],
        vec[0] * invViewProjMatrix[1]  + vec[1] * invViewProjMatrix[5]  + vec[2] * invViewProjMatrix[9]  + vec[3] * invViewProjMatrix[13],
        vec[0] * invViewProjMatrix[2]  + vec[1] * invViewProjMatrix[6]  + vec[2] * invViewProjMatrix[10] + vec[3] * invViewProjMatrix[14],
        vec[0] * invViewProjMatrix[3]  + vec[1] * invViewProjMatrix[7]  + vec[2] * invViewProjMatrix[11] + vec[3] * invViewProjMatrix[15]
    ];

    return [out[0] / out[3], out[1] / out[3], out[2] / out[3]];
}

function rayIntersectsQuad(rayOrigin, rayDir, quadVertices) {
    const [a, b, c, d] = quadVertices;


    return rayIntersectsTriangle(rayOrigin, rayDir, a, b, c) ||
           rayIntersectsTriangle(rayOrigin, rayDir, a, c, d);
}

function rayIntersectsTriangle(rayOrigin, rayDir, v0, v1, v2) {
    const EPSILON = 1e-8;
    const edge1 = [
        v1[0] - v0[0],
        v1[1] - v0[1],
        v1[2] - v0[2]
    ];
    const edge2 = [
        v2[0] - v0[0],
        v2[1] - v0[1],
        v2[2] - v0[2]
    ];

    const h = cross(rayDir, edge2);
    const a = dot(edge1, h);
    if (Math.abs(a) < EPSILON) return false;

    const f = 1.0 / a;
    const s = [
        rayOrigin[0] - v0[0],
        rayOrigin[1] - v0[1],
        rayOrigin[2] - v0[2]
    ];
    const u = f * dot(s, h);
    if (u < 0.0 || u > 1.0) return false;

    const q = cross(s, edge1);
    const v = f * dot(rayDir, q);
    if (v < 0.0 || u + v > 1.0) return false;

    const t = f * dot(edge2, q);
    return t > EPSILON;
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

function identityMatrix() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}








                                            //grid

//en enkelt linje (bræddet)
function AddGridLine(x1, y1, z1, x2, y2, z2, r, g, b) {
    AddVertex(x1, y1, z1, r, g, b);
    AddVertex(x2, y2, z2, r, g, b);
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
    const identityMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(identityMatrix));
    const groundVerticesCount = verticesGround.length / 6;

gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);

    gl.drawArrays(gl.LINES, 0, groundVerticesCount);
}




function modelMatrix() {
    //scale
    const sx = parseFloat(document.getElementById('scaleX').value) || 1;
    const sy = parseFloat(document.getElementById('scaleY').value) || 1;
    const sz = parseFloat(document.getElementById('scaleZ').value) || 1;


    //translation
    const tx = parseFloat(document.getElementById('transX').value) || 0;
    const ty = parseFloat(document.getElementById('transY').value) || 0;
    const tz = parseFloat(document.getElementById('transZ').value) || 0;

    //shear
    const shXY = parseFloat(document.getElementById('shXY').value) || 0;
    const shXZ = parseFloat(document.getElementById('shXZ').value) || 0;

    //rotate
    const rx = parseFloat(document.getElementById('rotX').value) * Math.PI / 180;
    const ry = parseFloat(document.getElementById('rotY').value) * Math.PI / 180;
    const rz = parseFloat(document.getElementById('rotZ').value) * Math.PI / 180;

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


function drawModel() {
    const matrix = modelMatrix();
    gl.uniformMatrix4fv(modelGL, false, new Float32Array(matrix));

    const shapeType = document.getElementById('shape').selectedIndex;
    if (shapeType === 0 || shapeType === 1) { 
        gl.disable(gl.CULL_FACE);
    } else {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK); 
    }


    if (document.getElementById('showLocalAxes')?.checked) {
        drawLocalAxes(matrix);
    }
    

    gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(1);
    

    const groundVerticesCount = verticesGround.length / 6;
    gl.drawArrays(gl.TRIANGLES, groundVerticesCount, verticesModel.length / 6);


    for (let face of faceList) {
        if (face.selected) {
            const verts = face.vertices;
    
            const highlightVerts = new Float32Array([
                ...verts[0], 0.0, 1.0, 0.5,
                ...verts[1], 0.0, 1.0, 0.5,
                ...verts[2], 0.0, 1.0, 0.5,
                ...verts[3], 0.0, 1.0, 0.5,
            ]);
    
            const highlightBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, highlightBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, highlightVerts, gl.STREAM_DRAW);
    
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
            gl.enableVertexAttribArray(1);

            gl.drawArrays(gl.LINE_LOOP, 0, 4);

            gl.bindBuffer(gl.ARRAY_BUFFER, mainVBO);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
            gl.enableVertexAttribArray(1);
        }
    }
}





                                                                  //mus


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















                                                                  //mobil 


                                                                  
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
