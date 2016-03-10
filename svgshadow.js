"use strict";
// http://www.w3.org/TR/SVG/paths.html

function RayToLineSegment(x, y, dx, dy, x0, y0, x1, y1)
{
	var r, s, d;
	//Make sure the lines aren't parallel
	if (dy / dx != (y1 - y0) / (x1 - x0))
	{
		d = ((dx * (y1 - y0)) - dy * (x1 - x0));
		if (d != 0)
		{
			r = (((y - y0) * (x1 - x0)) - (x - x0) * (y1 - y0)) / d;
			s = (((y - y0) * dx) - (x - x0) * dy) / d;
			if (r >= 0 && s >= 0 && s <= 1)
			{
				var intersectionX = x + r * dx;
				var intersectionY = y + r * dy;
				return {
					x: intersectionX,
					y: intersectionY,
					s: r * Math.sqrt(dx * dx + dy * dy),
					first: { type: 'L', startX: x0, startY: y0, endX: intersectionX, endY: intersectionY },
					second: { type: 'L', startX: intersectionX, startY: intersectionY, endX: x1, endY: y1 },
					intersections: 1
				};
			}
		}
	}
	return null;
}

// https://www.particleincell.com/2013/cubic-line-intersection/
function SplitCubicBezier(t, x0, y0, x1, y1, x2, y2, x3, y3)
{
	// Split the bezier curve at the time
	// https://en.wikipedia.org/wiki/De_Casteljau's_algorithm
	var x4 = x0 + (x1 - x0) * t;
	var y4 = y0 + (y1 - y0) * t;
	var x5 = x1 + (x2 - x1) * t;
	var y5 = y1 + (y2 - y1) * t;
	var x6 = x2 + (x3 - x2) * t;
	var y6 = y2 + (y3 - y2) * t;
	var x7 = x4 + (x5 - x4) * t;
	var y7 = y4 + (y5 - y4) * t;
	var x8 = x5 + (x6 - x5) * t;
	var y8 = y5 + (y6 - y5) * t;
	var x9 = x7 + (x8 - x7) * t;
	var y9 = y7 + (y8 - y7) * t;

	return {
		first:
		{
			type: 'C',
			startX: x0, startY: y0,
			x1: x4, y1: y4,
			x2: x7, y2: y7,
			endX: x9, endY: y9
		}, second:
		{
			type: 'C',
			startX: x9, startY: y9,
			x1: x8, y1: y8,
			x2: x6, y2: y6,
			endX: x3, endY: y3
		}
	};
}

// http://stackoverflow.com/a/27176424/254381
function CubicRoots(a, b, c, d)
{
	var CubicRoot = function(x)
	{
		var y = Math.pow(Math.abs(x), 1 / 3);
		return x < 0 ? -y : y;
	};

	if (Math.abs(a) < 1e-8) // Quadratic case, ax^2+bx+c=0
	{
		a = b;
		b = c;
		c = d;
		if (Math.abs(a) < 1e-8) // Linear case, ax+b=0
		{
			a = b;
			b = c;
			if (Math.abs(a) < 1e-8) // Degenerate case
			{
				return [];
			}
			return [-b / a];
		}

		var D = b*b - 4*a*c;
		if (Math.abs(D) < 1e-8)
		{
			return [-b / (2 * a)];
		}
		else if (D > 0)
		{
			return [(-b + Math.sqrt(D)) / (2 * a), (-b - Math.sqrt(D)) / (2 * a)];
		}
		return [];
	}

	// Convert to depressed cubic t^3+pt+q = 0 (subst x = t - b/3a)
	var p = (3 * a * c - b * b)/(3 * a * a);
	var q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
	var roots;

	if (Math.abs(p) < 1e-8) // p = 0 -> t^3 = -q -> t = -q^1 / 3
	{
		roots = [CubicRoot(-q)];
	}
	else if (Math.abs(q) < 1e-8) // q = 0 -> t^3 + pt = 0 -> t(t^2+p)=0
	{
		roots = [0].concat(p < 0 ? [Math.sqrt(-p), -Math.sqrt(-p)] : []);
	}
	else
	{
		var D = q * q / 4 + p * p * p / 27;
		if (Math.abs(D) < 1e-8) // D = 0 -> two roots
		{
			roots = [-1.5 * q / p, 3 * q / p];
		}
		else if (D > 0) // Only one real root
		{
			var u = CubicRoot(-q / 2 - Math.sqrt(D));
			roots = [u - p / (3 * u)];
		}
		else // D < 0, three roots, but needs to use complex numbers/trigonometric solution
		{
			var u = 2*Math.sqrt(-p / 3);
			var t = Math.acos(3 * q / p / u) / 3; // D < 0 implies p < 0 and acos argument in [-1..1]
			var k = 2 * Math.PI / 3;
			roots = [u * Math.cos(t), u * Math.cos(t - k), u * Math.cos(t - 2 * k)];
		}
	}

	// Convert back from depressed cubic
	for (var i = 0; i < roots.length; i++)
	{
		roots[i] -= b / (3 * a);
	}
	return roots;
}

function BezierCoefficients(p0, p1, p2, p3)
{
	return [
		-p0 + 3 * p1 + -3 * p2 + p3,
		3 * p0 - 6 * p1 + 3 * p2,
		-3 * p0 + 3 * p1,
		p0
	];
}

function RayToCubicBezier(x, y, dx, dy, x0, y0, x1, y1, x2, y2, x3, y3)
{
	var result = null;
	
	var xCoefficients = BezierCoefficients(x0, x1, x2, x3);
	var yCoefficients = BezierCoefficients(y0, y1, y2, y3);
	
	var r = CubicRoots(
		dy * xCoefficients[0] - dx * yCoefficients[0], // t^3
		dy * xCoefficients[1] - dx * yCoefficients[1], // t^2
		dy * xCoefficients[2] - dx * yCoefficients[2], // t
		dy * xCoefficients[3] - dx * yCoefficients[3] + x * -dy + y * dx // 1
	);

	var smallestS = Number.MAX_VALUE;
	
	var intersections = 0;
	// Verify the roots are in bounds of the linear segment.
	for (var i = 0; i < 3; ++i)
	{
		var t = r[i];
		
		var x_ = xCoefficients[0] * t * t * t + xCoefficients[1] * t * t + xCoefficients[2] * t + xCoefficients[3];
		var y_ = yCoefficients[0] * t * t * t + yCoefficients[1] * t * t + yCoefficients[2] * t + yCoefficients[3];
		
		// Determine if the intersection is after the position in the direction of the ray.
		var s;
		if (dx != 0)
		{
			s = (x_ - x) / dx;
		}
		else
		{
			s = (y_ - y) / dy;
		}
		// Record only the first intersection.
		if (t > 0 && t < 1.0 && s > 0)
		{
			intersections++;
			if (s < smallestS)
			{
				smallestS = s;
				result = SplitCubicBezier(t, x0, y0, x1, y1, x2, y2, x3, y3);
				result.x = x_;
				result.y = y_;
				result.s = s;
			}
			result.intersections = intersections;
		}
	}
	return result;
}

function CubicBezierTimeAtTangent(x0, y0, x1, y1, x2, y2, x3, y3, tx, ty)
{
	// http://stackoverflow.com/a/34837312/254381
	var tvals = [];
	var ax = 3 * x3 - 9 * x2 + 9 * x1 - 3 * x0;
	var ay = 3 * y3 - 9 * y2 + 9 * y1 - 3 * y0;
	var bx = 6*x2 - 12 * x1 + 6 * x0;
	var by = 6 * y2 - 12 * y1 + 6 * y0;
	var cx = 3 * x1 - 3 * x0;
	var cy = 3 * y1 - 3 * y0;
	var den = 2 * ax * ty - 2 * ay * tx;
	if (Math.abs(den) < 1E-10)
	{
		var num = ax * cy - ay * cx;
		var den = ax * by - ay * bx;
		if (den != 0)
		{
			var t = -num / den;
			if (t >= 0 && t <= 1)
			{
				tvals.push(t);
			}
		}
	}
	else
	{
		var delta = (bx * bx - 4 * ax * cx) * ty * ty + (-2 * bx * by + 4 * ay * cx + 4 * ax * cy) * tx * ty + (by * by - 4 * ay * cy) * tx * tx;
		var k = bx * ty - by * tx;
		tvals = [];
		if (delta >= 0 && den != 0)
		{
			var d = Math.sqrt(delta);
			var t0 = -(k + d) / den;
			var t1 = (-k + d) / den;
			if (t0 >= 0 && t0 < 1)
			{
				tvals.push(t0);
			}
			if (t1 >= 0 && t1 < 1)
			{
				tvals.push(t1);
			}
			tvals.sort();
		}
	}
	return tvals;
}


function RayToArc(x, y, dx, dy, cx, cy, rx, ry, rotation, angle, deltaAngle)
{
	var testVX = Math.cos(angle + deltaAngle / 2);
	var testVY = Math.sin(angle + deltaAngle / 2);

	var angleVX = Math.cos(angle);
	var angleVY = Math.sin(angle);

	x -= cx;
	y -= cy;
	
	// Transform the ray position and direction relative to the axis-aligned ellipse.
	var x_ = Math.cos(rotation) * x + Math.sin(rotation) * y;
	var y_ = -Math.sin(rotation) * x + Math.cos(rotation) * y;
	
	var dx_ = Math.cos(rotation) * dx + Math.sin(rotation) * dy;
	var dy_ = -Math.sin(rotation) * dx + Math.cos(rotation) * dy;
	
	x = x_;
	y = y_;
	dx = dx_;
	dy = dy_;

	var intersections = 0;
	
	var rotateResult = function(resultX, resultY, distance)
	{
		var vx = resultX / rx;
		var vy = resultY / ry;
		var resultAngle = Math.atan2(vy, vx);
		if (resultAngle < 0)
		{
			resultAngle += 2 * Math.PI;
		}
		
		var divideArc = function(inputAngle, inputDeltaAngle)
		{
			var x0 = Math.cos(rotation) * (rx * Math.cos(inputAngle)) - Math.sin(rotation) * (ry * Math.sin(inputAngle)) + cx;
			var y0 = Math.sin(rotation) * (rx * Math.cos(inputAngle)) + Math.cos(rotation) * (ry * Math.sin(inputAngle)) + cy;
			
			var x1 = Math.cos(rotation) * (rx * Math.cos(inputAngle + inputDeltaAngle)) - Math.sin(rotation) * (ry * Math.sin(inputAngle + inputDeltaAngle)) + cx;
			var y1 = Math.sin(rotation) * (rx * Math.cos(inputAngle + inputDeltaAngle)) + Math.cos(rotation) * (ry * Math.sin(inputAngle + inputDeltaAngle)) + cy;
			
			var largeArcFlag = Math.abs(inputDeltaAngle) > Math.PI ? 1 : 0;
			var sweepFlag = inputDeltaAngle > 0 ? 1 : 0;
			
			return { type: 'A', cx: cx, cy: cy, rx: rx, ry: ry, rotation: rotation, angle: inputAngle, deltaAngle: inputDeltaAngle, largeArcFlag: largeArcFlag, sweepFlag: sweepFlag, startX: x0, startY: y0, endX: x1, endY: y1 };
		}

		var s;
		if (dx_ == 0)
		{
			s = distance / dy_;
		}
		else
		{
			s = distance / dx_;
		}
		
		var resultDeltaAngle = Math.asin(angleVX * vy - angleVY * vx);
		if (deltaAngle > 0 && resultDeltaAngle < 0)
		{
			resultDeltaAngle += 2 * Math.PI;
		}
		else if (deltaAngle < 0 && resultDeltaAngle > 0)
		{
			resultDeltaAngle -= 2 * Math.PI;
		}
		
		var result =
		{
			x: Math.cos(rotation) * resultX - Math.sin(rotation) * resultY + cx,
			y: Math.sin(rotation) * resultX + Math.cos(rotation) * resultY + cy,
			s: s,
			angle: resultAngle,
			first: divideArc(angle, resultDeltaAngle),
			second: divideArc(angle + resultDeltaAngle, deltaAngle - resultDeltaAngle),
		};

		// Make sure the result is within our arc. If not return null.
		// acos(dot(a, b)) returns the angle between two normalized vectors
		if (Math.acos(testVX * vx + testVY * vy) < Math.abs(deltaAngle / 2))
		{
			intersections++;
			result.intersections = intersections;
			return result;
		}
		else
		{
			return null;
		}
	}
	
	if (dx == 0)
	{
		var ty = (ry / rx) * Math.sqrt(rx * rx - x * x);
		if (dy * (ty - y) > 0)
		{
			return rotateResult(x, ty, Math.abs(ty - y));
		}
		if (dy * (-ty - y) > 0)
		{
			return rotateResult(x, -ty, Math.abs(-ty - y));
		}
	}
	else
	{
		var closestIntersection = null;
		var closestIntersectionDistance = Number.MAX_VALUE;

		var a = dy / dx;
		var b = (y - a * x);
		
		var r = a * a * rx * rx + ry * ry;
		var s = 2 * a * b * rx * rx;
		var t = rx * rx * b * b - rx * rx * ry * ry;
		
		var d = s * s - 4 * r * t;

		if (d > 0)
		{
			var xi1 = (-s + Math.sqrt(d)) / (2 * r);
			var xi2 = (-s - Math.sqrt(d)) / (2 * r);

			var yi1 = a * xi1 + b;
			var yi2 = a * xi2 + b;

			var distance1 = (xi1 - x) * (xi1 - x) + (yi1 - y) *  (yi1 - y);
			if (dx * (xi1 - x) + dy * (yi1 - y) > 0)
			{
				closestIntersection = rotateResult(xi1, yi1, Math.sqrt(distance1));
				if (closestIntersection)
				{
					closestIntersectionDistance = distance1;
				}
			}
			
			if (dx * (xi2 - x) + dy * (yi2 - y) > 0)
			{
				var distance2 = (xi2 - x) * (xi2 - x) + (yi2 - y) *  (yi2 - y);
				// This must be calculated because we want to find out how many intersections there were.
				var intersection = rotateResult(xi2, yi2, Math.sqrt(distance2));
				if (distance2 < closestIntersectionDistance && intersection)
				{
					closestIntersection = intersection;
				}
			}
			return closestIntersection;
		}
		else if (d == 0)
		{
			var xi = -s / (2 * r);
			var yi = a * xi + b;
			
			if (dx * (xi - x) + dy * (yi - y) > 0)
			{
				return rotateResult(xi, yi, Math.sqrt((xi - x) * (xi - x) + (yi - y) *  (yi - y)));
			}
		}
	}
	return null;
}

function CubicBezierPosition(t, x0, y0, x1, y1, x2, y2, x3, y3)
{
	var x4 = x0 + (x1 - x0) * t;
	var y4 = y0 + (y1 - y0) * t;
	var x5 = x1 + (x2 - x1) * t;
	var y5 = y1 + (y2 - y1) * t;
	var x6 = x2 + (x3 - x2) * t;
	var y6 = y2 + (y3 - y2) * t;
	var x7 = x4 + (x5 - x4) * t;
	var y7 = y4 + (y5 - y4) * t;
	var x8 = x5 + (x6 - x5) * t;
	var y8 = y5 + (y6 - y5) * t;
	var x9 = x7 + (x8 - x7) * t;
	var y9 = y7 + (y8 - y7) * t;
	return { x: x9, y: y9 };
}

function ArcMidPoint(cx, cy, rx, ry, rotation, angle, deltaAngle)
{
	var midPointAngle = angle + deltaAngle / 2;
	return {
		x: Math.cos(rotation) * (rx * Math.cos(midPointAngle)) - Math.sin(rotation) * (ry * Math.sin(midPointAngle)) + cx,
		y: Math.sin(rotation) * (rx * Math.cos(midPointAngle)) + Math.cos(rotation) * (ry * Math.sin(midPointAngle)) + cy
	};
}

function PathToSVGShadowPath(svgPath, width, height)
{
	var largeEpsilon = 0.01;
	var epsilon = 0.001;
	
	var lightDirection = { x: 1, y: 1 };
	var length = Math.sqrt(lightDirection.x * lightDirection.x + lightDirection.y * lightDirection.y);
	lightDirection.x /= length;
	lightDirection.y /= length;
	var lightDirectionNormal = { x: lightDirection.y, y: -lightDirection.x };
	
	var startPosition = { x: 0, y: 0 };
	var position = { x: 0, y: 0 };
	
	var fullPaths = [];
	var fullPath = [];
	
	var AddPath = function(path)
	{
		fullPath.push(path);
	};
	
	var EndPath = function()
	{
		if (fullPath.length != 0)
		{
			var startX = fullPath[0].startX;
			var startY = fullPath[0].startY;
			var endX = fullPath[fullPath.length - 1].endX;
			var endY = fullPath[fullPath.length - 1].endY;
			if ((startX - endX) * (startX - endX) + (startY - endY) * (startY - endY) > epsilon)
			{
				fullPath.push({ type: 'L', startX: endX, startY: endY, endX: startX, endY: startY });
			}
			fullPaths.push(fullPath);
			fullPath = [];
		}
	};
	
	svgPath.split(/(?=[A-Za-z])/).forEach(function(operation, operationIndex)
	{
		var operationType = operation[0];
		var args = operation.split(/[A-Za-z ]/);
		args = args.map(function(arg)
		{
			arg = arg.split(',');
			arg = arg.map(function(value) { return parseFloat(value); });
			if (arg.length == 2)
			{
				return { x: arg[0], y: arg[1] };
			}
			else
			{
				return arg[0];
			}
		});
		args.shift();
		
		//console.log(operationIndex, ' ', operationType, ' ', args);
		
		// Only M, L, C, A, H, V, Z are used
		switch (operationType)
		{
			// Start a new sub-path at the given (x,y) coordinate. M (uppercase) indicates that absolute coordinates will follow; m (lowercase) indicates that relative coordinates will follow. If a moveto is followed by multiple pairs of coordinates, the subsequent pairs are treated as implicit lineto commands. Hence, implicit lineto commands will be relative if the moveto is relative, and absolute if the moveto is absolute. If a relative moveto (m) appears as the first element of the path, then it is treated as a pair of absolute coordinates. In this case, subsequent pairs of coordinates are treated as relative even though the initial moveto is interpreted as an absolute moveto.
			case 'M': // moveto (absolute) Parameters: (x y)+
				if (fullPath.length != 0)
				{
					if (Math.abs(position.x - startPosition.x) > epsilon || Math.abs(position.y - startPosition.y) > epsilon)
					{
						AddPath({ type: 'L', startX: position.x, startY: position.y, endX: startPosition.x, endY: startPosition.y });
					}
					EndPath();
				}
				position.x = args[0].x;
				position.y = args[0].y;
				
				startPosition = { x: position.x, y: position.y };
				
				for (var itr = 1; itr < args.length; ++itr)
				{
					var x = args[itr].x;
					var y = args[itr].y;
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: y });
					
					position.x = x;
					position.y = y;
				}
				break;
			case 'm': // moveto (relative)
				if (operationIndex == 0)
				{
					position.x = args[0].x;
					position.y = args[0].y;
				}
				else
				{
					position.x += args[0].x;
					position.y += args[0].y;
				}
				
				startPosition = { x: position.x, y: position.y };
				
				for (var itr = 1; itr < args.length; ++itr)
				{
					var x = position.x + args[itr].x;
					var y = position.y + args[itr].y;
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: y });
					
					position.x = x;
					position.y = y;
				}
				break;
			// Close the current subpath by drawing a straight line from the current point to current subpath's initial point. Since the Z and z commands take no parameters, they have an identical effect.
			case 'Z': // closepath (absolute) Parameters: (none)
			case 'z': // closepath (relative)
				if (position.x != startPosition.x && startPosition.y != position.y)
				{
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: startPosition.x, endY: startPosition.y });
				}
				EndPath();
				break;
			// Draw a line from the current point to the given (x,y) coordinate which becomes the new current point. L (uppercase) indicates that absolute coordinates will follow; l (lowercase) indicates that relative coordinates will follow. A number of coordinates pairs may be specified to draw a polyline. At the end of the command, the new current point is set to the final set of coordinates provided.
			case 'L': // lineto (absolute) Parameters: (x y)+
				for (var itr = 0; itr < args.length; ++itr)
				{
					var x = args[itr].x;
					var y = args[itr].y;
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: y });
					
					position.x = x;
					position.y = y;
				}
				break;
			case 'l': // lineto (relative)
				for (var itr = 0; itr < args.length; itr += 3)
				{
					var x = position.x + args[itr].x;
					var y = position.y + args[itr].y;
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: y });
					
					position.x = x;
					position.y = y;
				}
				break;
			// Draws a horizontal line from the current point (cpx, cpy) to (x, cpy). H (uppercase) indicates that absolute coordinates will follow; h (lowercase) indicates that relative coordinates will follow. Multiple x values can be provided (although usually this doesn't make sense). At the end of the command, the new current point becomes (x, cpy) for the final value of x.
			case 'H': // horizontal lineto (absolute) Parameters: x+
				for (var itr = 0; itr < args.length; ++itr)
				{
					var x = args[itr];
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: position.y });
					
					position.x = x;
				}
				break;
			case 'h': // horizontal lineto (relative)
				for (var itr = 0; itr < args.length; ++itr)
				{
					var x = position.x + args[itr];
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: x, endY: position.y });
					
					position.x = x;
				}
				break;
			// Draws a vertical line from the current point (cpx, cpy) to (cpx, y). V (uppercase) indicates that absolute coordinates will follow; v (lowercase) indicates that relative coordinates will follow. Multiple y values can be provided (although usually this doesn't make sense). At the end of the command, the new current point becomes (cpx, y) for the final value of y.
			case 'V': // vertical lineto (absolute) Parameters: y+
				for (var itr = 0; itr < args.length; ++itr)
				{
					var y = args[itr];
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: position.x, endY: y });
					
					position.y = y;
				}
				break;
			case 'v': // vertical lineto (relative)
				for (var itr = 0; itr < args.length; ++itr)
				{
					var y = position.y + args[itr];
					
					AddPath({ type: 'L', startX: position.x, startY: position.y, endX: position.x, endY: y });
					
					position.y = y;
				}
				break;
			// Draws a cubic Bézier curve from the current point to (x,y) using (x1,y1) as the control point at the beginning of the curve and (x2,y2) as the control point at the end of the curve. C (uppercase) indicates that absolute coordinates will follow; c (lowercase) indicates that relative coordinates will follow. Multiple sets of coordinates may be specified to draw a polybézier. At the end of the command, the new current point becomes the final (x,y) coordinate pair used in the polybézier.
			case 'C': // curveto (absolute) Parameters: (x1 y1 x2 y2 x y)+
				for (var itr = 0; itr < args.length; itr += 3)
				{
					var x1 = args[itr].x;
					var y1 = args[itr].y;
					var x2 = args[itr + 1].x;
					var y2 = args[itr + 1].y;
					var x = args[itr + 2].x;
					var y = args[itr + 2].y;
					
					var tvals = CubicBezierTimeAtTangent(position.x, position.y, x1, y1, x2, y2, x, y, lightDirection.x, lightDirection.y);
					
					if (tvals.length > 0)
					{
						var split1 = SplitCubicBezier(tvals[0], position.x, position.y, x1, y1, x2, y2, x, y);
						AddPath(split1.first);
						if (tvals.length > 1)
						{
							var split2 = SplitCubicBezier((tvals[1] - tvals[0]) / (1 - tvals[0]), split1.second.startX, split1.second.startY, split1.second.x1, split1.second.y1, split1.second.x2, split1.second.y2, split1.second.endX, split1.second.endY);
							AddPath(split2.first);
							AddPath(split2.second);
						}
						else
						{
							AddPath(split1.second);
						}
					}
					else
					{
						var normal = { x: y - position.y, y: position.x - x };
						AddPath({ type: 'C', startX: position.x, startY: position.y, x1: x1, y1: y1, x2: x2, y2: y2, endX: x, endY: y });
					}
					position.x = x;
					position.y = y;
				}
				break;
			case 'c': // curveto (relative)
				for (var itr = 0; itr < args.length; itr += 3)
				{
					var x1 = position.x + args[itr].x;
					var y1 = position.y + args[itr].y;
					var x2 = position.x + args[itr + 1].x;
					var y2 = position.y + args[itr + 1].y;
					var x = position.x + args[itr + 2].x;
					var y = position.y + args[itr + 2].y;
					
					var tvals = CubicBezierTimeAtTangent(position.x, position.y, x1, y1, x2, y2, x, y, lightDirection.x, lightDirection.y);
					
					if (tvals.length > 0)
					{
						var split1 = SplitCubicBezier(tvals[0], position.x, position.y, x1, y1, x2, y2, x, y);
						AddPath(split1.first);
						if (tvals.length > 1)
						{
							var split2 = SplitCubicBezier((tvals[1] - tvals[0]) / (1 - tvals[0]), split1.second.startX, split1.second.startY, split1.second.x1, split1.second.y1, split1.second.x2, split1.second.y2, split1.second.endX, split1.second.endY);
							AddPath(split2.first);
							AddPath(split2.second);
						}
						else
						{
							AddPath(split1.second);
						}
					}
					else
					{
						var normal = { x: y - position.y, y: position.x - x };
						AddPath({ type: 'C', startX: position.x, startY: position.y, x1: x1, y1: y1, x2: x2, y2: y2, endX: x, endY: y });
					}
					
					position.x = x;
					position.y = y;
				}
				break;
			// Draws a cubic Bézier curve from the current point to (x,y). The first control point is assumed to be the reflection of the second control point on the previous command relative to the current point. (If there is no previous command or if the previous command was not an C, c, S or s, assume the first control point is coincident with the current point.) (x2,y2) is the second control point (i.e., the control point at the end of the curve). S (uppercase) indicates that absolute coordinates will follow; s (lowercase) indicates that relative coordinates will follow. Multiple sets of coordinates may be specified to draw a polybézier. At the end of the command, the new current point becomes the final (x,y) coordinate pair used in the polybézier.
			case 'S': // shorthand/smooth curveto (absolute) Parameters: (x2 y2 x y)+
				throw 'Not implemented';
				break;
			case 's': // shorthand/smooth curveto (relative)
				throw 'Not implemented';
				break;
			// Draws a quadratic Bézier curve from the current point to (x,y) using (x1,y1) as the control point. Q (uppercase) indicates that absolute coordinates will follow; q (lowercase) indicates that relative coordinates will follow. Multiple sets of coordinates may be specified to draw a polybézier. At the end of the command, the new current point becomes the final (x,y) coordinate pair used in the polybézier.
			case 'Q': // quadratic Bézier curveto (absolute) Parameters: (x1 y1 x y)+
				throw 'Not implemented';
				break;
			case 'q': // quadratic Bézier curveto (relative)
				throw 'Not implemented';
				break;
			// Draws a quadratic Bézier curve from the current point to (x,y). The control point is assumed to be the reflection of the control point on the previous command relative to the current point. (If there is no previous command or if the previous command was not a Q, q, T or t, assume the control point is coincident with the current point.) T (uppercase) indicates that absolute coordinates will follow; t (lowercase) indicates that relative coordinates will follow. At the end of the command, the new current point becomes the final (x,y) coordinate pair used in the polybézier.
			case 'T': // Shorthand/smooth quadratic Bézier curveto (absolute) Parameters: (x y)+
				throw 'Not implemented';
				break;
			case 't': // Shorthand/smooth quadratic Bézier curveto (relative)
				throw 'Not implemented';
				break;
			// Draws an elliptical arc from the current point to (x, y). The size and orientation of the ellipse are defined by two radii (rx, ry) and an x-axis-rotation, which indicates how the ellipse as a whole is rotated relative to the current coordinate system. The center (cx, cy) of the ellipse is calculated automatically to satisfy the constraints imposed by the other parameters. large-arc-flag and sweep-flag contribute to the automatic calculations and help determine how the arc is drawn.
			case 'A': // elliptical arc (absolute) Parameters: (rx ry x-axis-rotation large-arc-flag sweep-flag x y)+
				for (var itr = 0; itr < args.length; itr += 4)
				{
					// TODO: Technically if rx or ry are 0 then this needs to be treated like a lineto operation.
					var rx = args[itr].x;
					var ry = args[itr].y;
					var rotation = Math.PI / 180 * (args[itr + 1] % 360);
					var largeArcFlag = args[itr + 2].x == 1;
					var sweepFlag = args[itr + 2].y == 1;
					var x = args[itr + 3].x;
					var y = args[itr + 3].y;
					
					// http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
					// Use the conversion from endpoint to center parameterization in the linked documentation
					var x1_ = Math.cos(rotation) * ((position.x - x) / 2) + Math.sin(rotation) * ((position.y - y) / 2);
					var y1_ = -Math.sin(rotation) * ((position.x - x) / 2) + Math.cos(rotation) * ((position.y - y) / 2);
					
					var radiiCheck = x1_ * x1_ / (rx * rx) + y1_ * y1_ / (ry * ry);
					if (radiiCheck > 1)
					{
						rx = Math.sqrt(radiiCheck) * rx;
						ry = Math.sqrt(radiiCheck) * ry;
					}
					
					var c = (largeArcFlag != sweepFlag ? 1 : -1) * Math.sqrt((rx * rx * ry * ry - rx * rx * y1_ * y1_ - ry * ry * x1_ * x1_) / (rx * rx * y1_ * y1_ + ry * ry * x1_ * x1_));
					var cx_ = c * rx * y1_ / ry;
					var cy_ = c * -ry * x1_ / rx;
					
					var cx = Math.cos(rotation) * cx_ - Math.sin(rotation) * cy_ + (position.x + x) / 2;
					var cy = Math.sin(rotation) * cx_ + Math.cos(rotation) * cy_ + (position.y + y) / 2;
					
					var angleBetweenVectors = function(ux, uy, vx, vy)
					{
						return (ux * vy - uy * vx <= 0 ? -1 : 1) * Math.acos(Math.max(-1, (ux * vx + uy * vy) / (Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy))));
					}
					
					var angle = Math.atan2((y1_ - cy_) / ry, (x1_ - cx_) / rx);
					if (angle < 0)
					{
						angle = 2 * Math.PI + angle;
					}
					
					var deltaAngle = angleBetweenVectors((x1_ - cx_) / rx, (y1_ - cy_) / ry, (-x1_ - cx_) / rx, (-y1_ - cy_) / ry);
					deltaAngle %= Math.PI * 2;
					
					if (!sweepFlag && deltaAngle > 0)
					{
						deltaAngle -= Math.PI * 2;
					}
					else if (sweepFlag && deltaAngle < 0)
					{
						deltaAngle += Math.PI * 2;
					}
					
					// Rotate the light direction by the inverse of the rotation matrix. transformLightDirectionX isn't used
					//var transformLightDirectionX = Math.cos(rotation) * lightDirection.x + Math.sin(rotation) * lightDirection.y;
					var transformLightDirectionY = -Math.sin(rotation) * lightDirection.x + Math.cos(rotation) * lightDirection.y;
					
					// This will only work for light directions in the range (-1, 0) aka 180 degrees to (0, 1) 270 degrees. Our light direction is (-0.707, 0.707) aka 225 degrees.
					var theta1 = Math.acos(-transformLightDirectionY * rx / Math.sqrt(transformLightDirectionY * transformLightDirectionY * rx * rx - transformLightDirectionY * transformLightDirectionY * ry * ry + ry * ry));
					var theta2 = theta1 + Math.PI;
					
					// Use the conversion from center to endpoint parameterization in the linked documentation
					var addArc = function(inputAngle, inputDeltaAngle)
					{
						var x1 = Math.cos(rotation) * (rx * Math.cos(inputAngle)) - Math.sin(rotation) * (ry * Math.sin(inputAngle)) + cx;
						var y1 = Math.sin(rotation) * (rx * Math.cos(inputAngle)) + Math.cos(rotation) * (ry * Math.sin(inputAngle)) + cy;
						
						var x2 = Math.cos(rotation) * (rx * Math.cos(inputAngle + inputDeltaAngle)) - Math.sin(rotation) * (ry * Math.sin(inputAngle + inputDeltaAngle)) + cx;
						var y2 = Math.sin(rotation) * (rx * Math.cos(inputAngle + inputDeltaAngle)) + Math.cos(rotation) * (ry * Math.sin(inputAngle + inputDeltaAngle)) + cy;
						
						var largeArcFlag = Math.abs(inputDeltaAngle) > Math.PI ? 1 : 0;
						var sweepFlag = inputDeltaAngle > 0 ? 1 : 0;
						
						AddPath({ type: 'A', cx: cx, cy: cy, rx: rx, ry: ry, rotation: rotation, angle: inputAngle, deltaAngle: inputDeltaAngle, largeArcFlag: largeArcFlag, sweepFlag: sweepFlag, startX: x1, startY: y1, endX: x2, endY: y2 });
					}
					
					var startAngle = angle;
					var endAngle = angle + deltaAngle;
					
					if (deltaAngle > 0)
					{
						if (theta1 < startAngle)
						{
							theta1 += 2 * Math.PI;
						}
						if (theta2 < startAngle)
						{
							theta2 += 2 * Math.PI;
						}
						if (theta1 >= endAngle)
						{
							theta1 -= 2 * Math.PI;
						}
						if (theta2 >= endAngle)
						{
							theta2 -= 2 * Math.PI;
						}
						
						if (theta1 > startAngle && theta1 < endAngle && theta2 > startAngle && theta2 < endAngle)
						{
							var minAngle = Math.min(theta1, theta2);
							var maxAngle = Math.max(theta1, theta2);
							addArc(startAngle, minAngle - startAngle);
							addArc(minAngle, maxAngle - minAngle);
							addArc(maxAngle, endAngle - maxAngle);
						}
						if (theta1 > startAngle && theta1 < endAngle)
						{
							addArc(startAngle, theta1 - startAngle);
							addArc(theta1, endAngle - theta1);
						}
						else if (theta2 > startAngle && theta2 < endAngle)
						{
							addArc(startAngle, theta2 - startAngle);
							addArc(theta2, endAngle - theta2);
						}
						else
						{
							addArc(startAngle, endAngle - startAngle);
						}
					}
					else
					{
						if (theta1 < endAngle)
						{
							theta1 += 2 * Math.PI;
						}
						if (theta2 < endAngle)
						{
							theta2 += 2 * Math.PI;
						}
						if (theta1 >= startAngle)
						{
							theta1 -= 2 * Math.PI;
						}
						if (theta2 >= startAngle)
						{
							theta2 -= 2 * Math.PI;
						}
						
						if (theta1 < startAngle && theta1 > endAngle && theta2 < startAngle && theta2 > endAngle)
						{
							var minAngle = Math.max(theta1, theta2);
							var maxAngle = Math.min(theta1, theta2);
							addArc(startAngle, minAngle - startAngle);
							addArc(minAngle, maxAngle - minAngle);
							addArc(maxAngle, endAngle - maxAngle);
						}
						else if (theta1 < startAngle && theta1 > endAngle)
						{
							addArc(startAngle, theta1 - startAngle);
							addArc(theta1, endAngle - theta1);
						}
						else if (theta2 < startAngle && theta2 > endAngle)
						{
							addArc(startAngle, theta2 - startAngle);
							addArc(theta2, endAngle - theta2);
						}
						else
						{
							addArc(startAngle, endAngle - startAngle);
						}
					}
					position.x = x;
					position.y = y;
				}
				break;
			case 'a': // elliptical arc (relative)
				for (var itr = 0; itr < args.length; itr += 4)
				{
					var rx = args[itr].x;
					var ry = args[itr].y;
					var rotation = args[itr + 1];
					var largeArcFlag = args[itr + 2].x == 1;
					var sweepFlag = args[itr + 2].y == 1;
					var x = position.x + args[itr + 3].x;
					var y = position.y + args[itr + 3].y;
					
					throw 'Not implemented';
					
					position.x = x;
					position.y = y;
				}
				break;
		}
	});
	
	EndPath();
	
	var frontfacePaths = [];
	var frontfacePath = [];
	
	AddPath = function(path)
	{
		frontfacePath.push(path);
	};
	
	EndPath = function()
	{
		if (frontfacePath.length != 0)
		{
			frontfacePaths.push(frontfacePath);
			frontfacePath = [];
		}
	};
	
	// This method is kind of fragile due to floating point errors.
	var PointInPath = function(fullPath, x, y)
	{
		// We use the ray (1, 2) for sanity since it bypasses a few edge cases when using (1, 0). Essentially when using (1, 0) the RayToCubicBezier has cases where the coefficients are near zero causing calculation problems later.
		var rayX = 1 / Math.sqrt(1 * 1 + 2 * 2);
		var rayY = 2 / Math.sqrt(1 * 1 + 2 * 2);
		var inside = false;
		for (var itr = 0; itr < fullPaths.length; ++itr)
		{
			var fullPath = fullPaths[itr];
			for (var itrPart = 0; itrPart < fullPath.length; ++itrPart)
			{
				var part = fullPath[itrPart];
				switch (part.type)
				{
					case 'L':
						var intersection = RayToLineSegment(x, y, rayX, rayY, part.startX, part.startY, part.endX, part.endY);
						if (intersection)
						{
							inside = !inside;
						}
						break;
					case 'C':
						var intersection = RayToCubicBezier(x, y, rayX, rayY, part.startX, part.startY, part.x1, part.y1, part.x2, part.y2, part.endX, part.endY);
						if (intersection && intersection.intersections % 2 == 1)
						{
							inside = !inside;
						}
						break;
					case 'A':
						var intersection = RayToArc(x, y, rayX, rayY, part.cx, part.cy, part.rx, part.ry, part.rotation, part.angle, part.deltaAngle);
						if (intersection && intersection.intersections == 1)
						{
							inside = !inside;
						}
						break;
				}
			}
		}
		return inside;
	};
	
	for (var itr = 0; itr < fullPaths.length; ++itr)
	{
		var fullPath = fullPaths[itr];
		for (var itrPart = 0; itrPart < fullPath.length; ++itrPart)
		{
			var part = fullPath[itrPart];
			var normalX = part.endY - part.startY;
			var normalY = part.startX - part.endX;
			var length = Math.sqrt(normalX * normalX + normalY * normalY);
			normalX /= length;
			normalY /= length;
			var startDistance = Math.sqrt((part.startX + 1) * lightDirectionNormal.x + (part.startY - (height + 1)) * lightDirectionNormal.y);
			var endDistance = Math.sqrt((part.endX + 1) * lightDirectionNormal.x + (part.endY - (height + 1)) * lightDirectionNormal.y);
			
			switch (part.type)
			{
				case 'L':
					var midpointX = (part.startX + part.endX) / 2;
					var midpointY = (part.startY + part.endY) / 2;
					// Creates a point offset from the line to check if the normal is inside or outside of the path
					var offsetPointX = midpointX + normalX * epsilon + epsilon * 0.1; // The epsilon * 0.1 is extra jitter since there are very common edge cases that can occur with vertical and horizontal lines
					var offsetPointY = midpointY + normalY * epsilon + epsilon * 0.1;
					if (PointInPath(fullPaths, offsetPointX, offsetPointY))
					{
						EndPath();
						if (endDistance - startDistance < 0.01)
						{
							// Reverse svg path
							AddPath({ type: 'L', startX: part.endX, startY: part.endY, endX: part.startX, endY: part.startY });
							EndPath();
						}
					}
					else
					{
						if (startDistance - endDistance < 0.01)
						{
							AddPath(part);
						}
						else
						{
							EndPath();
						}
					}
					break;
				case 'C':
					var midPoint = CubicBezierPosition(0.5, part.startX, part.startY, part.x1, part.y1, part.x2, part.y2, part.endX, part.endY);
					var midpointX = midPoint.x;
					var midpointY = midPoint.y;
					// Creates a point offset from the cubic bezier curve to check if the normal is inside or outside of the path. The normal here is just an approximation treating the start and end as a line.
					var offsetPointX = midpointX + normalX * epsilon;
					var offsetPointY = midpointY + normalY * epsilon;
					if (PointInPath(fullPaths, offsetPointX, offsetPointY))
					{
						EndPath();
						if (endDistance - startDistance < 0.01)
						{
							// Reverse svg path
							AddPath({ type: 'C', startX: part.endX, startY: part.endY, x1: part.x2, y1: part.y2, x2: part.x1, y2: part.y1, endX: part.startX, endY: part.startY });
							EndPath();
						}
					}
					else
					{
						if (startDistance - endDistance < 0.01)
						{
							AddPath(part);
						}
						else
						{
							EndPath();
						}
					}
					break;
				case 'A':
					var midPoint = ArcMidPoint(part.cx, part.cy, part.rx, part.ry, part.rotation, part.angle, part.deltaAngle);
					var midpointX = midPoint.x;
					var midpointY = midPoint.y;
					// Creates a point offset from the line to check if the normal is inside or outside of the path
					var offsetPointX = midpointX + normalX * epsilon;
					var offsetPointY = midpointY + normalY * epsilon;
					if (PointInPath(fullPaths, offsetPointX, offsetPointY))
					{
						EndPath();
						if (endDistance - startDistance < 0.01)
						{
							// Reverse svg path
							AddPath({ type: 'A', cx: part.cx, cy: part.cy, rx: part.rx, ry: part.ry, rotation: part.rotation, angle: (part.angle + part.deltaAngle) % (2 * Math.PI), deltaAngle: -part.deltaAngle, largeArcFlag: part.largeArcFlag, sweepFlag: !part.sweepFlag, startX: part.endX, startY: part.endY, endX: part.startX, endY: part.startY });
							EndPath();
						}
					}
					else
					{
						if (startDistance - endDistance < 0.01)
						{
							AddPath(part);
						}
						else
						{
							EndPath();
						}
					}
					break;
			}
		}
		EndPath();
	}
	
	// Depending on where we started a backface path we might have to join two of them. This would only fail if a path object shared the start and end point with another path. Very unlikely.
	for (var itrA = 0; itrA < frontfacePaths.length - 1; ++itrA)
	{
		var frontfacePathA = frontfacePaths[itrA];
		var startPathA = frontfacePathA[0];
		var endPathA = frontfacePathA[frontfacePathA.length - 1];
		for (var itrB = itrA + 1; itrB < frontfacePaths.length; ++itrB)
		{
			var frontfacePathB = frontfacePaths[itrB];
			var startPathB = frontfacePathB[0];
			var endPathB = frontfacePathB[frontfacePathB.length - 1];
			// Combine paths that share or start or end position
			if (Math.abs(startPathA.startX - endPathB.endX) < epsilon && Math.abs(startPathA.startY - endPathB.endY) < epsilon)
			{
				// Append path A to path B
				for (var itrAppend = 0; itrAppend < frontfacePaths[itrA].length; ++itrAppend)
				{
					frontfacePaths[itrB].push(frontfacePaths[itrA][itrAppend]);
				}
				frontfacePathA = frontfacePaths[itrB];
				frontfacePaths[itrA] = frontfacePathA;
				startPathA = frontfacePathA[0];
				endPathA = frontfacePathA[frontfacePathA.length - 1];
				frontfacePaths.splice(itrB, 1);
				itrB = itrA;
			}
			else if (Math.abs(endPathA.endX - startPathB.startX) < epsilon && Math.abs(endPathA.endY - startPathB.startY) < epsilon)
			{
				// Append path B to path A
				for (var itrAppend = 0; itrAppend < frontfacePaths[itrB].length; ++itrAppend)
				{
					frontfacePaths[itrA].push(frontfacePaths[itrB][itrAppend]);
				}
				endPathA = frontfacePathA[frontfacePathA.length - 1];
				frontfacePaths.splice(itrB, 1);
				itrB = itrA;
			}
		}
	}
	// Calculate the distance from the light direction normal. We need this to process all the front face path subpaths in the direction along the light direction's normal.
	var sortedFrontFacePaths = [];
	for (var itr = 0; itr < frontfacePaths.length; ++itr)
	{
		var frontfacePath = frontfacePaths[itr];
		// Add an extra path item that just stores the distance for the end of the path.
		frontfacePath.push(
		{
			startX: frontfacePath[frontfacePath.length - 1].endX,
			startY: frontfacePath[frontfacePath.length - 1].endY,
			dot: (frontfacePath[frontfacePath.length - 1].endX - frontfacePath[frontfacePath.length - 1].startX) * lightDirection.x + (frontfacePath[frontfacePath.length - 1].endY - frontfacePath[frontfacePath.length - 1].startY) * lightDirection.y
		});
		for (var pathItr = 0; pathItr < frontfacePath.length; ++pathItr)
		{
			var path = frontfacePath[pathItr];
			sortedFrontFacePaths.push(
			{
				index: itr,
				pathIndex: pathItr,
				distance: Math.sqrt((path.startX + 1) * lightDirectionNormal.x + (path.startY - (height + 1)) * lightDirectionNormal.y), // Distance from the bottom left corner when the position is projected onto the lightDirection normal vector
				depth: path.startX * lightDirection.x + path.startY * lightDirection.y, // Distance squared from the top left corner when the position is projected onto the lightDirection vector
				path: path,
				start: pathItr == 0,
				end: pathItr == frontfacePath.length - 1,
				dot: 'dot' in path ? path.dot : (path.endX - path.startX) * lightDirection.x + (path.endY - path.startY) * lightDirection.y // Used as a tie-breaker in the sort if both depths are the same
			});
			delete path.dot;
		}
	}
	sortedFrontFacePaths.sort(function(path1, path2)
	{
		return path1.distance < path2.distance ? -1 : 1;
	});
	
	// Process the front face paths in the order of their distance along the light direction normal extracting the connected front face volumes across multiple front face paths.
	var shadowVolumePaths = [];
	var shadowVolumePath = [];
	var AddShadowVolumePath = function(path)
	{
		shadowVolumePath.push(path);
	}
	
	var EndShadowVolumePath = function()
	{
		shadowVolumePaths.push(shadowVolumePath);
		shadowVolumePath = [];
	}
	var current = null;
	var startedPaths = [];
	var temp = 0;
	while (sortedFrontFacePaths.length != 0)
	{
		temp++; if (temp == 100) break;
		// Find groups of paths with equal distance and then based on the group's properties like if the group contains a start path, middle path, end path, and based on the depth determine which paths to use and determine whether to insert the other paths into the startedPaths array or to remove items from the startedPath array if they're end paths.
		var frontFaceGroup = [];
		var closestDistance = sortedFrontFacePaths[0].distance;
		for (var itr = 0; itr < sortedFrontFacePaths.length; ++itr)
		{
			var path = sortedFrontFacePaths[itr];
			// This group will include any path that is 0.01 from the previous path
			if (path.distance < closestDistance + 0.01)
			{
				closestDistance = path.distance;
				frontFaceGroup.push(path);
				// Remove the front face
				sortedFrontFacePaths.splice(itr--, 1);
			}
			else
			{
				break;
			}
		}
		// Distance no longer matters since we assume every path in the group is at the same distance so sort by depth
		frontFaceGroup.sort(function(path1, path2)
		{
			// Sort by index first then by depth
			if (path1.index == path2.index)
			{
				return path1.pathIndex - path2.pathIndex;
			}
			// For when paths share a point. Very rare, but it happens. (See the Bing icon).
			if (Math.abs(path1.depth - path2.depth) < epsilon)
			{
				// This essentially uses the dot product to compare the direction relative to the lightDirection choosing the one that's pointed more away from the light direction
				return path1.dot < path2.dot ? -1 : 1;
			}
			return path1.depth < path2.depth ? -1 : 1;
		});
		
		var removeCurrentPathFromGroup = function()
		{
			for (var itr = 0; itr < frontFaceGroup.length - 1; ++itr)
			{
				// If the first frontface is part of the current path and the next item in the frontface group is also part of the current path then include it in the path.
				if (frontFaceGroup[itr].index == current.index && frontFaceGroup[itr + 1].index == current.index)
				{
					AddShadowVolumePath(current.path);
					current = frontFaceGroup[itr];
					frontFaceGroup.splice(itr--, 1);
				}
				else
				{
					break;
				}
			}
		};
		
		var appendCurrentPathsFromGroup = function()
		{
			for (var itr = 0; itr < frontFaceGroup.length; ++itr)
			{
				if (frontFaceGroup[itr].index == current.index)
				{
					AddShadowVolumePath(current.path);
					current = frontFaceGroup[itr];
					frontFaceGroup.splice(itr--, 1);
				}
				else
				{
					break;
				}
			}
		};
		
		var removeSamePathsFromGroup = function()
		{
			for (var itr = 0; itr < frontFaceGroup.length - 1; ++itr)
			{
				if (frontFaceGroup[itr].index == current.index && frontFaceGroup[itr + 1].index == current.index)
				{
					frontFaceGroup.splice(itr--, 1);
				}
				else
				{
					break;
				}
			}
		};
		
		var removeRedundantPathsFromGroupKeepingLast = function()
		{
			// Remove paths that belong to the same index keeping the last one
			for (var itr = 0; itr < frontFaceGroup.length - 1; ++itr)
			{
				if (frontFaceGroup[itr].index == frontFaceGroup[itr + 1].index)
				{
					frontFaceGroup.splice(itr--, 1);
				}
			}
		};
		
		// TODO: Is this necessary? The startedPath code might remove this since it'll find both the start and end when looping.
		// Special case code to remove paths if the frontFaceGroup contains both the start and end of the path. This is probably a diagonal line by itself.
		for (var itr1 = 0; itr1 < frontFaceGroup.length - 1; ++itr1)
		{
			var path1 = frontFaceGroup[itr1];
			if (path1.start)
			{
				// path1 is a start path. Search after this point to find the path's end. If it exists remove the whole path
				for (var itr2 = itr1 + 1; itr2 < frontFaceGroup.length; ++itr2)
				{
					var path2 = frontFaceGroup[itr2];
					if (path2.index == path1.index && path2.end)
					{
						frontFaceGroup.splice(itr1--, itr2 - itr1 + 1);
						break;
					}
				}
			}
		}
		// The previous removal of paths could have removed all of the paths. If that happens move to the next group
		if (frontFaceGroup.length == 0)
		{
			continue;
		}
		
		if (current == null)
		{
			// Push the itr and if it's a start or end. If it's an end then if it has the same itr then continue else check distance and raycast stuff.
			do
			{
				current = frontFaceGroup.shift();
			} while (frontFaceGroup.length != 0 && frontFaceGroup[0].index == current.index);
			// TODO: Abstract this code since it's duplicated a few time
			for (var frontFaceGroupItr = 0; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
			{
				var path = frontFaceGroup[frontFaceGroupItr];
				var removedOrReplaced = false;
				for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
				{
					if (startedPaths[startedPathsItr].index == path.index)
					{
						if (path.end)
						{
							startedPaths.splice(startedPathsItr--, 1);
						}
						else
						{
							startedPaths[startedPathsItr] = path;
						}
						removedOrReplaced = true;
						break;
					}
				}
				if (!path.end && !removedOrReplaced)
				{
					startedPaths.push(path);
				}
			}
		}
		else
		{
			removeCurrentPathFromGroup();
			
			var hasCurrentNextPath = null;
			var hasCurrentEndPath = null;
			for (var itr = 0; itr < frontFaceGroup.length; ++itr)
			{
				var path = frontFaceGroup[itr];
				if (path.index == current.index)
				{
					hasCurrentNextPath = path;
					if (path.end)
					{
						hasCurrentEndPath = path;
					}
				}
				else if (path.end)
				{
					frontFaceGroup.splice(itr--, 1);
					for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
					{
						if (startedPaths[startedPathsItr].index == path.index)
						{
							startedPaths.splice(startedPathsItr--, 1);
							break;
						}
					}
					// Go backwards and remove any path in the front face group with the same index. Since this group has the end path then any part of the path is no longer useful.
					while (itr >= 0 && frontFaceGroup[itr].index == path.index)
					{
						frontFaceGroup.splice(itr--, 1);
					}
				}
			}
			
			if (frontFaceGroup.length == 0)
			{
				continue;
			}
			
			if (frontFaceGroup[0].index == current.index)
			{
				AddShadowVolumePath(current.path);
				
				if (frontFaceGroup[0].end)
				{
					var currentPath = current.path;
					var smallestS = Number.MAX_VALUE;
					var next = null;
					var frontFaceGroupIndex = null;
					var startedPathsNextIndex = null;
					var connectingPath;
					
					for (var frontFaceGroupItr = 1; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
					{
						var path = frontFaceGroup[frontFaceGroupItr];
						// If a front face group path exists with the same index skip this one
						var ignore = false;
						for (var frontFaceGroupItr2 = frontFaceGroupItr + 1; frontFaceGroupItr2 < frontFaceGroup.length; ++frontFaceGroupItr2)
						{
							if (frontFaceGroup[frontFaceGroupItr2].index == path.index)
							{
								frontFaceGroup[frontFaceGroupItr2].ignore = true;
								ignore = true;
							}
						}
						if (ignore)
						{
							continue;
						}
						
						var pathPath = path.path;
						var s = Math.sqrt((pathPath.startX - currentPath.endX) * (pathPath.startX - currentPath.endX) + (pathPath.startY - currentPath.endY) * (pathPath.startY - currentPath.endY));
						if (s < smallestS)
						{
							smallestS = s;
							connectingPath = { type: 'L', startX: currentPath.endX, startY: currentPath.endY, endX: pathPath.startX, endY: pathPath.startY };
							next = path;
							frontFaceGroupIndex = frontFaceGroupItr;
							for (var itr = 0; itr < startedPaths.length; ++itr)
							{
								if (startedPaths[itr].index == path.index)
								{
									startedPathsNextIndex = itr;
								}
							}
						}
					}
					
					// Insersect all startedPaths and select the closest.
					for (var itr = 0; itr < startedPaths.length; ++itr)
					{
						var path = startedPaths[itr].path;
						var skip = false;
						for (var frontFaceGroupItr = 1; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
						{
							if (frontFaceGroup[frontFaceGroupItr].index == startedPaths[itr].index)
							{
								skip = true;
								break;
							}
						}
						if (skip)
						{
							continue;
						}
						
						var intersection;
						switch (path.type)
						{
							case 'L':
								intersection = RayToLineSegment(currentPath.endX, currentPath.endY, lightDirection.x, lightDirection.y, path.startX, path.startY, path.endX, path.endY);
								break;
							case 'C':
								intersection = RayToCubicBezier(currentPath.endX, currentPath.endY, lightDirection.x, lightDirection.y, path.startX, path.startY, path.x1, path.y1, path.x2, path.y2, path.endX, path.endY);
								break;
							case 'A':
								intersection = RayToArc(currentPath.endX, currentPath.endY, lightDirection.x, lightDirection.y, path.cx, path.cy, path.rx, path.ry, path.rotation, path.angle, path.deltaAngle);
								break;
						}
						if (intersection && intersection.s < smallestS)
						{
							smallestS = intersection.s;
							connectingPath = { type: 'L', startX: currentPath.endX, startY: currentPath.endY, endX: intersection.x, endY: intersection.y };
							next = { path: intersection.second, index: startedPaths[itr].index };
							frontFaceGroupIndex = null;
							startedPathsNextIndex = itr;
						}
					}
					if (next != null)
					{
						AddShadowVolumePath(connectingPath);
						current = next;
						// removeSamePathsFromGroup();
						if (frontFaceGroupIndex != null)
						{
							frontFaceGroup.splice(frontFaceGroupIndex, 1);
						}
						if (startedPathsNextIndex != null)
						{
							startedPaths.splice(startedPathsNextIndex, 1);
						}
					}
					else
					{
						EndShadowVolumePath();
						current = null;
					}
					
					for (var frontFaceGroupItr = 1; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
					{
						var path = frontFaceGroup[frontFaceGroupItr];
						var removedOrReplaced = false;
						for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
						{
							if (startedPaths[startedPathsItr].index == path.index)
							{
								if (path.end)
								{
									throw true;
									startedPaths.splice(startedPathsItr--, 1);
								}
								else
								{
									startedPaths[startedPathsItr] = path;
								}
								removedOrReplaced = true;
								break;
							}
						}
						if (!path.end && !removedOrReplaced && !('ignore' in path))
						{
							startedPaths.push(path);
						}
					}
				}
				else
				{
					// This is still the same front face so add it to the volume path and update the top of the depth queue.
					current = frontFaceGroup.shift();
					appendCurrentPathsFromGroup();
					for (var frontFaceGroupItr = 0; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
					{
						var path = frontFaceGroup[frontFaceGroupItr];
						var removedOrReplaced = false;
						for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
						{
							if (startedPaths[startedPathsItr].index == path.index)
							{
								if (path.end)
								{
									startedPaths.splice(startedPathsItr--, 1);
								}
								else
								{
									startedPaths[startedPathsItr] = path;
								}
								removedOrReplaced = true;
								break;
							}
						}
						if (!path.end && !removedOrReplaced)
						{
							startedPaths.push(path);
						}
					}
				}
			}
			else
			{
				if (frontFaceGroup[0].start)
				{
					var path = frontFaceGroup[0].path; // TODO: Abstract this out to a variable outside that isn't called path.
					var currentPath = current.path;
					if (hasCurrentNextPath)
					{
						AddShadowVolumePath(current.path);
						current = hasCurrentNextPath;
						currentPath = current.path;
						AddShadowVolumePath({ type: 'L', startX: currentPath.startX, startY: currentPath.startY, endX: path.startX, endY: path.startY });
						if (hasCurrentEndPath == null)
						{
							startedPaths.push(current);
						}
						current = frontFaceGroup.shift();
					}
					else
					{
						// Start of this path
						switch (currentPath.type)
						{
							case 'L':
								var intersection = RayToLineSegment(path.startX, path.startY, lightDirection.x, lightDirection.y, currentPath.startX, currentPath.startY, currentPath.endX, currentPath.endY);
								if (intersection)
								{
									AddShadowVolumePath(intersection.first);
									AddShadowVolumePath({ type: 'L', startX: intersection.x, startY: intersection.y, endX: path.startX, endY: path.startY });
									startedPaths.push(current);
									current = frontFaceGroup.shift();
								}
								else
								{
									startedPaths.push(frontFaceGroup.shift());
								}
								break;
							case 'C':
								var intersection = RayToCubicBezier(path.startX, path.startY, lightDirection.x, lightDirection.y, currentPath.startX, currentPath.startY, currentPath.x1, currentPath.y1, currentPath.x2, currentPath.y2, currentPath.endX, currentPath.endY);
								if (intersection)
								{
									AddShadowVolumePath(intersection.first);
									AddShadowVolumePath({ type: 'L', startX: intersection.x, startY: intersection.y, endX: path.startX, endY: path.startY });
									startedPaths.push(current);
									current = frontFaceGroup.shift();
								}
								else
								{
									startedPaths.push(frontFaceGroup.shift());
								}
								break;
							case 'A':
								var intersection = RayToArc(path.startX, path.startY, lightDirection.x, lightDirection.y, currentPath.cx, currentPath.cy, currentPath.rx, currentPath.ry, currentPath.rotation, currentPath.angle, currentPath.deltaAngle);
								if (intersection)
								{
									AddShadowVolumePath(intersection.first);
									AddShadowVolumePath({ type: 'L', startX: intersection.x, startY: intersection.y, endX: path.startX, endY: path.startY });
									startedPaths.push(current);
									current = frontFaceGroup.shift();
								}
								else
								{
									startedPaths.push(frontFaceGroup.shift());
								}
								break;
						}
					}
					appendCurrentPathsFromGroup();
					for (var frontFaceGroupItr = 0; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
					{
						var path = frontFaceGroup[frontFaceGroupItr];
						var removedOrReplaced = false;
						for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
						{
							if (startedPaths[startedPathsItr].index == path.index)
							{
								if (path.end)
								{
									startedPaths.splice(startedPathsItr--, 1);
								}
								else
								{
									startedPaths[startedPathsItr] = path;
								}
								removedOrReplaced = true;
								break;
							}
						}
						if (!path.end && !removedOrReplaced)
						{
							startedPaths.push(path);
						}
					}
				}
				else if (frontFaceGroup[0].end)
				{
					throw true;
					// Find the path in the startedPaths and remove it.
					for (var itr = 0; itr < startedPaths.length; ++itr)
					{
						if (startedPaths[itr].index == frontFaceGroup[0].index)
						{
							startedPaths.splice(itr, 1);
							break;
						}
					}
				}
				else
				{
					// Processing a subpath that is neither the start nor the end, so update the startedPaths to point to the current subpath for that front face path.
					for (var frontFaceGroupItr = 0; frontFaceGroupItr < frontFaceGroup.length; ++frontFaceGroupItr)
					{
						var path = frontFaceGroup[frontFaceGroupItr];
						var removedOrReplaced = false;
						for (var startedPathsItr = 0; startedPathsItr < startedPaths.length; ++startedPathsItr)
						{
							if (startedPaths[startedPathsItr].index == path.index)
							{
								if (path.end)
								{
									startedPaths.splice(startedPathsItr--, 1);
								}
								else
								{
									startedPaths[startedPathsItr] = path;
								}
								removedOrReplaced = true;
								break;
							}
						}
						if (!path.end && !removedOrReplaced)
						{
							startedPaths.push(path);
						}
					}
				}
			}
		}
	}
	
	var shadowPath = '';
	for (var itr = 0; itr < shadowVolumePaths.length; ++itr)
	{
		var shadowVolumePath = shadowVolumePaths[itr];
		var endPath = shadowVolumePath[shadowVolumePath.length - 1];
		var startPositionX = shadowVolumePath[0].startX;
		var startPositionY = shadowVolumePath[0].startY;
		var endPositionX = endPath.endX;
		var endPositionY = endPath.endY;
		
		var startIntersectBottomX = startPositionX + lightDirection.x * (height - startPositionY) / lightDirection.y;
		var startIntersectRightY = startPositionY + lightDirection.y * (width - startPositionX) / lightDirection.x;
		var endIntersectBottomX = endPositionX + lightDirection.x * (height - endPositionY) / lightDirection.y;
		var endIntersectRightY = endPositionY + lightDirection.y * (width - endPositionX) / lightDirection.x;
		
		// TODO: Correct for floating point errors
		if (startPositionY == height && endPositionY == height)
		{
			shadowVolumePath.push({ type: 'Z' });
		}
		else if (startPositionY == height && endPositionX == width)
		{
			shadowVolumePath.push({ type: 'L', startX: endPositionX, startY: endPositionY, endX: width, endY: height });
			shadowVolumePath.push({ type: 'Z' });
		}
		else if (startPositionX == width && endPositionX == width)
		{
			shadowVolumePath.push({ type: 'Z' });
		}
		else if (startIntersectBottomX <= width && endIntersectRightY <= height)
		{
			if (endPositionX != width)
			{
				shadowVolumePath.push({ type: 'L', startX: endPositionX, startY: endPositionY, endX: width, endY: endIntersectRightY });
			}
			shadowVolumePath.push({ type: 'L', startX: width, startY: endIntersectRightY, endX: width, endY: height });
			if (startPositionY != height)
			{
				shadowVolumePath.push({ type: 'L', startX: width, startY: height, endX: startIntersectBottomX, endY: height });
			}
			shadowVolumePath.push({ type: 'Z' });
		}
		else if (startIntersectRightY <= height && endIntersectRightY <= height)
		{
			if (endPositionX != width)
			{
				shadowVolumePath.push({ type: 'L', startX: endPositionX, startY: endPositionY, endX: width, endY: endIntersectRightY });
			}
			if (startPositionX != width)
			{
				shadowVolumePath.push({ type: 'L', startX: width, startY: endIntersectRightY, endX: width, endY: startIntersectRightY });
			}
			shadowVolumePath.push({ type: 'Z' });
		}
		else if (startIntersectBottomX <= width && endIntersectBottomX <= width)
		{
			if (endPositionY != height)
			{
				shadowVolumePath.push({ type: 'L', startX: endPositionX, startY: endPositionY, endX: endIntersectBottomX, endY: height });
			}
			if (startPositionY != height)
			{
				shadowVolumePath.push({ type: 'L', startX: endIntersectBottomX, startY: height, endX: startIntersectBottomX, endY: height });
			}
			shadowVolumePath.push({ type: 'Z' });
		}
		
		for (var pathItr = 0; pathItr < shadowVolumePath.length; ++pathItr)
		{
			var previous = shadowVolumePath[(pathItr + shadowVolumePath.length - 1) % shadowVolumePath.length];
			var current = shadowVolumePath[pathItr];
			if (previous.type == 'L' && current.type == 'L')
			{
				var directionX = current.endX - previous.startX;
				var directionY = current.endY - previous.startY;
				var distance = Math.sqrt(directionX * directionX + directionY * directionY);
				if (distance > 1) // magic number so we don't remove small curves
				{
					directionX /= distance;
					directionY /= distance;
					var previousDirectionX = previous.endX - previous.startX;
					var previousDirectionY = previous.endY - previous.startY;
					// Project the previousDirection onto the normal of the direction vector and calculate the distance
					if (Math.abs(previousDirectionX * directionY - previousDirectionY * directionX) < 0.1)
					{
						previous.endX = current.endX;
						previous.endY = current.endY;
						shadowVolumePath.splice(pathItr--, 1);
					}
				}
			}
		}
		
		var RoundFloat = function(value)
		{
			return parseFloat(value.toFixed(2));
		};
		
		var previousType = '';
		for (var pathItr = 0; pathItr < shadowVolumePath.length; ++pathItr)
		{
			var path = shadowVolumePath[pathItr];
			if (pathItr == 0)
			{
				shadowPath += 'M' + RoundFloat(path.startX) + ',' + RoundFloat(path.startY);
				previousType = 'M';
			}
			switch (path.type)
			{
				case 'Z':
					shadowPath += 'Z';
					break;
				case 'L':
					if (Math.abs(path.startY - path.endY) < epsilon)
					{
						shadowPath += (previousType == 'H' ? ' ' : 'H') + RoundFloat(path.endX);
						previousType = 'H';
					}
					else if(Math.abs(path.startX - path.endX) < epsilon)
					{
						shadowPath += (previousType == 'V' ? ' ' : 'V') + RoundFloat(path.endY);
						previousType = 'V';
					}
					else
					{
						shadowPath += (previousType == 'L' ? ' ' : 'L') + RoundFloat(path.endX) + ',' + RoundFloat(path.endY);
						previousType = 'L';
					}
					break;
				case 'C':
					shadowPath += (previousType == 'C' ? ' ' : 'C') + RoundFloat(path.x1) + ',' + RoundFloat(path.y1) + ' ' + RoundFloat(path.x2) + ',' + RoundFloat(path.y2) + ' ' + RoundFloat(path.endX) + ',' + RoundFloat(path.endY);
					previousType = 'C';
					break;
				case 'A':
					shadowPath += (previousType == 'A' ? ' ' : 'A') + RoundFloat(path.rx) + ',' + RoundFloat(path.ry) + ' ' + RoundFloat(path.rotation) + ' ' + (path.largeArcFlag ? 1 : 0) + ',' + (path.sweepFlag ? 1 : 0) + ' ' + RoundFloat(path.endX) + ',' + RoundFloat(path.endY);
					previousType = 'A';
					break;
			}
		}
	}
	return shadowPath;
}
