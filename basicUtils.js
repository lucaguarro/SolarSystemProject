function degToRad(d) {
    return d * Math.PI / 180;
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function emod(x, n) {
    return x >= 0 ? (x % n) : ((n - (-x % n)) % n);
}