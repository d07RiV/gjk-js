// GJK for Javascript by Riv
// requires gl-matrix library: https://github.com/toji/gl-matrix/

/********
// example shape class
function Shape() {
  this.vertices = [];
  this.support = function(d) {
    var v = this.vertices, res = v[0], d = vec3.dot(d, res);
    for (var i = 0; i < v.length; ++i) {
      var c = vec3.dot(d, v[i]);
      if (c > d) { d = c; res = v[i]; }
    }
    return res;
  };
}
********/

var GJK = (function() {
  // function GJK(sh1, sh2[, dir])
  // sh1 and sh2 must have a `support(d)' method, which returns the furthest point along d
  // returned point must be persistent (i.e. not overwritten by a further call to support)
  // dir is the initial search direction (normalized); optional
  // returns a pair of closest points between sh1 and sh2, or null if the shapes intersect

  // temporaries for internal use
  var tmp1 = vec3.create(), tmp2 = vec3.create(), tmp3 = vec3.create(),
      tmp4 = vec3.create(), tmp5 = vec3.create(), tmp6 = vec3.create(),
      tmp7 = vec3.create(), tmat = new Float32Array(9);

  // p1, p2, p3 store the current simplex vertices; p0 is the point to be added
  // ai are the corresponding vertices in the first shape (ai - bi = pi)
  // count is the current number of vertices in the simplex
  var p0 = vec3.create(), p1 = vec3.create(), p2 = vec3.create(), p3 = vec3.create();
  var a0, a1, a2, a3, count;

  // direction towards the origin
  var D = vec3.create();

  // result holder
  var result = [vec3.create(), vec3.create()];

  // helper function, calculates (a x b) x a
  function cross_aba(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    out[0] = cy * az - cz * ay;
    out[1] = cz * ax - cx * az;
    out[2] = cx * ay - cy * ax;
    return out;
  }

  // triple product (a x b) . c
  function triple(a, b, c) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2];
    return c[0] * (ay * bz - az * by) + c[1] * (az * bx - ax * bz) + c[2] * (ax * by - ay * bx);
  }

  // adds p0 to the simplex
  function extend() {
    switch (count) {
    case 0:
      // empty simplex
      // simply add the point
      var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
      count = 1;
      vec3.negate(D, p1);
      return false;
    case 1:
      // point case
      var ao = vec3.negate(tmp1, p0);
      var ab = vec3.subtract(tmp2, p1, p0);
      if (vec3.dot(ab, ao) > 0) {
        // inside the segment
        var t = p2; p2 = p1; p1 = p0; p0 = t; a2 = a1; a1 = a0; // c=b, b=a
        cross_aba(D, ab, ao);
        count = 2;
      } else {
        // point A
        var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
        vec3.copy(D, ao);
      }
      return false;
    case 2:
      // segment case
      var ao = vec3.negate(tmp1, p0);
      var ab = vec3.subtract(tmp2, p1, p0);
      var ac = vec3.subtract(tmp3, p2, p0);
      var abc = vec3.cross(tmp4, ab, ac);
      if (triple(ab, abc, ao) < 0 && triple(abc, ac, ao) < 0) {
        // inside the triangle
        // ensure that the origin is in front of the plane defined by ABC
        if (vec3.dot(abc, ao) > 0) {
          var t = p3; p3 = p2; p2 = p1; p1 = p0; p0 = t; a3 = a2; a2 = a1; a1 = a0; // d=c, c=b, b=a
          vec3.copy(D, abc);
        } else {
          var t = p3; p3 = p1; p1 = p0; p0 = t; a3 = a1; a1 = a0; // d=b, b=a
          vec3.negate(D, abc);
        }
        count = 3;
      } else {
        if (vec3.dot(ab, ao) > 0) {
          // segment AB
          var t = p2; p2 = p1; p1 = p0; p0 = t; a2 = a1; a1 = a0; // c=b, b=a
          cross_aba(D, ab, ao);
        } else if (vec3.dot(ac, ao) > 0) {
          // segment AC
          var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
          cross_aba(D, ac, ao);
        } else {
          // point A
          var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
          vec3.copy(D, ao);
          count = 1;
        }
      }
      return false;
    case 3:
      // triangle case
      // we are guaranteed that the origin is in front of the triangle defined
      // by BCD (counter-clockwise)
      var ao = vec3.negate(tmp1, p0);
      var ab = vec3.subtract(tmp2, p1, p0);
      var ac = vec3.subtract(tmp3, p2, p0);
      var ad = vec3.subtract(tmp5, p3, p0);
      var abc = vec3.cross(tmp4, ab, ac);
      var acd = vec3.cross(tmp6, ac, ad);
      var adb = vec3.cross(tmp7, ad, ab);
      var abco = vec3.dot(abc, ao);
      var acdo = vec3.dot(acd, ao);
      var adbo = vec3.dot(adb, ao);
      if (abco < 0 && acdo < 0 && adbo < 0) {
        // inside the tetrahedron, finish algorithm
        return true;
      }
      if (abco >= 0 && triple(ab, abc, ao) < 0 && triple(abc, ac, ao) < 0) {
        // triangle ABC
        var t = p3; p3 = p2; p2 = p1; p1 = p0; p0 = t; a3 = a2; a2 = a1; a1 = a0; // d=c, c=b, b=a
        vec3.copy(D, abc);
        return false;
      }
      if (acdo >= 0 && triple(ac, acd, ao) < 0 && triple(acd, ad, ao) < 0) {
        // triangle ACD
        var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
        vec3.copy(D, acd);
        return false;
      }
      if (adbo >= 0 && triple(ad, adb, ao) < 0 && triple(adb, ab, ao) < 0) {
        // triangle ADB
        var t = p2; p2 = p3; p3 = p1; p1 = p0; p0 = t; a2 = a3; a3 = a1; a1 = a0; // c=d, d=b, b=a
        vec3.copy(D, adb);
        return false;
      }
      if (vec3.dot(ab, ao) > 0) {
        // segment AB
        var t = p2; p2 = p1; p1 = p0; p0 = t; a2 = a1; a1 = a0; // c=b, b=a
        cross_aba(D, ab, ao);
        count = 2;
      } else if (vec3.dot(ac, ao) > 0) {
        // segment AC
        var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
        cross_aba(D, ac, ao);
        count = 2;
      } else if (vec3.dot(ad, ao) > 0) {
        // segment AD
        var t = p1; p1 = p0; p0 = t; t = p2; p2 = p3; p3 = t; a1 = a0; a2 = a3; // b=a, c=d
        cross_aba(D, ad, ao);
        count = 2;
      } else {
        // point A
        var t = p1; p1 = p0; p0 = t; a1 = a0; // b=a
        vec3.copy(D, ao);
        count = 1;
      }
      return false;
    }
    // wtf?
    return false;
  }

  // returns the pair of closest points
  function closest() {
    // count = 1,2,3
    vec3.scale(p0, D, vec3.dot(p1, D));
    switch (count) {
    case 3:
      // attempt to solve 3x3 linear system to find baricentric coordinates of p0
      tmat.set(p1, 0);
      tmat.set(p2, 3);
      tmat.set(p3, 6);
      if (Math.abs(mat3.determinant(tmat)) > 1e-4) {
        mat3.invert(tmat, tmat);
        vec3.transformMat3(tmp1, p0, tmat);
        var t1 = tmp1[0], t2 = tmp1[1], t3 = tmp1[2];
        result[0][0] = a1[0] * t1 + a2[0] * t2 + a3[0] * t3;
        result[0][1] = a1[1] * t1 + a2[1] * t2 + a3[1] * t3;
        result[0][2] = a1[2] * t1 + a2[2] * t2 + a3[2] * t3;
        break;
      }
      // degenerate case, fall through
      if (vec3.squaredDistance(p1, p2) < 1e-4) {
        // but use a different pair of points
        var t = p2; p2 = p3; p3 = t; a2 = a3; // c=d
      }
    case 2:
      // interpolation on a segment
      var ab = vec3.subtract(tmp1, p2, p1);
      var ap = vec3.subtract(tmp2, p0, p1);
      var len = vec3.dot(ab, ab);
      if (len > 1e-4) {
        vec3.lerp(result[0], a1, a2, vec3.dot(ap, ab) / vec3.dot(ab, ab));
        break;
      }
      // degenerate case, fall through
    case 1:
      vec3.copy(result[0], a1);
      break;
    }
    // p0 = a0 - b0, thus b0 = a0 - p0
    vec3.subtract(result[1], result[0], p0);
    return result;
  }

  return function(sh1, sh2, dir) {
    if (dir) vec3.copy(D, dir);
    else vec3.set(D, 1, 0, 0);
    // start with an empty simplex
    count = 0;
    for (var iter = 20; iter--;) {
      // find next point
      a0 = sh1.support(D);
      vec3.negate(tmp1, D);
      var b0 = sh2.support(tmp1);
      vec3.subtract(p0, a0, b0);
      if (count && vec3.dot(p0, D) < vec3.dot(p1, D) + 0.01) {
        // no significant improvement, the closest point must be on the current simplex
        return closest();
      }
      if (extend()) {
        // shapes intersect
        return null;
      }
      vec3.normalize(D, D);
    }
    // iteration limit exceeded, what do?
    return null;
  };
})();
