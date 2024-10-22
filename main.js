import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class VoxelWorld {
	// a cell is a chunk of voxels and a grid of such cells will form
	// a map. our cell will be 32x32x32.
	constructor(cellSize) {
		this.cellSize = cellSize;
		this.cellSliceSize = cellSize * cellSize;
		this.cell = new Uint8Array(cellSize * cellSize * cellSize);
	}

	// get cell coordinates from voxel coordinates
	getCellForVoxel(x, y, z) {
		const {cellSize} = this;
		const cellX = Math.floor(x / cellSize);
		const cellY = Math.floor(y / cellSize);
		const cellZ = Math.floor(z / cellSize);

		if (cellX != 0 || cellY != 0 || cellZ != 0) {
			return null;
		}
		return this.cell;
	}

	computeVoxelOffset(x, y, z) {
		const {cellSize, cellSliceSize} = this;

		const voxelX = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
		const voxelY = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
		const voxelZ = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
		return voxelY * cellSliceSize + voxelZ * cellSize + voxelX;
	}

	// set voxel of type v on coords (x, y, z)
	setVoxel(x, y, z, v) {
		let cell = this.getCellForVoxel(x, y, z);

		if (!cell) {
			return;
		}

		const voxelOffset = this.computeVoxelOffset(x, y, z);
		cell[voxelOffset] = v;
	}

	// get voxel from provided coordinates
	getVoxel(x, y, z) {
		const cell = this.getCellForVoxel(x, y, z);
		
		if (!cell) {
			return 0;
		}

		const voxelOffset = this.computeVoxelOffset(x, y, z);
		return cell[voxelOffset];
	}

	// for (0, 0, 0), we consider voxels (0-31x, 0-31y, 0-31z)
	// for (1, 0, 0), we consider voxels (32-63x, 0-31y, 0-31z)
	generateGeometryDataForCell(cellX, cellY, cellZ) {
		const {cellSize} = this;
		const positions = [];
		const normals = [];
		const indices = [];
		const startX = cellX * cellSize;
		const startY = cellY * cellSize;
		const startZ = cellZ * cellSize;

		for (let y = 0; y < cellSize; ++y) {
			const voxelY = startY + y;
			for (let z = 0; z < cellSize; ++z) {
				const voxelZ = startZ + z;
				for (let x = 0; x < cellSize; ++x) {
					const voxelX = startX + x;

					const voxel = this.getVoxel(voxelX, voxelY, voxelZ);

					if (voxel) {
						for (const {dir, vertices} of VoxelWorld.faces) {
							// try getting the neighbor of the voxel
							const neighbor = this.getVoxel(
								voxelX + dir[0], // neighbor along x-axis
								voxelY + dir[1], // neighbor along y-axis
								voxelZ + dir[2]  // neighbor along z-axis
							)

							// if there is no neighbor, then render a face
							if (!neighbor) {
								const ndx = positions.length / 3;

								for (const pos of vertices) {
									positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
									normals.push(...dir);
								}

								indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
							}
						}
					}
				}
			}
		}

		return { positions, normals, indices };
	}
}

// store all faces of a voxel which includes the coords of the vertices
// and the direction of the normal
VoxelWorld.faces = [
	{ // left
		dir: [ -1,  0,  0, ],
		vertices: [
			[ 0, 1, 0 ],
			[ 0, 0, 0 ],
			[ 0, 1, 1 ],
			[ 0, 0, 1 ],
		],
	},
	{ // right
		dir: [  1,  0,  0, ],
		vertices: [
			[ 1, 1, 1 ],
			[ 1, 0, 1 ],
			[ 1, 1, 0 ],
			[ 1, 0, 0 ],
	  	],
	},
	{ // bottom
	  	dir: [  0, -1,  0, ],
	  	vertices: [
			[ 1, 0, 1 ],
			[ 0, 0, 1 ],
			[ 1, 0, 0 ],
			[ 0, 0, 0 ],
	  	],
	},
	{ // top
	  	dir: [  0,  1,  0, ],
	 	vertices: [
			[ 0, 1, 1 ],
			[ 1, 1, 1 ],
			[ 0, 1, 0 ],
			[ 1, 1, 0 ],
	  	],
	},
	{ // back
	  	dir: [  0,  0, -1, ],
	 	vertices: [
			[ 1, 0, 0 ],
			[ 0, 0, 0 ],
			[ 1, 1, 0 ],
			[ 0, 1, 0 ],
	  	],
	},
	{ // front
	 	dir: [  0,  0,  1, ],
	  	vertices: [
			[ 0, 0, 1 ],
			[ 1, 0, 1 ],
			[ 0, 1, 1 ],
			[ 1, 1, 1 ],
	  	],
	},
];


function main() {
	const canvas = document.querySelector( '#c' );
	const renderer = new THREE.WebGLRenderer({antialias: true, canvas});

	const cellSize = 32;

	const world = new VoxelWorld(cellSize);

	const fov = 75;
	const aspect = 2; // the canvas default
	const near = 0.1;
	const far = 1000;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.set( - cellSize * .3, cellSize * .8, - cellSize * .3 );

	const controls = new OrbitControls( camera, canvas );
	controls.target.set( cellSize / 2, cellSize / 3, cellSize / 2 );
	controls.update();

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 'lightblue' );

	// add directional light to scene
	{
		const color = 0xFFFFFF;
		const intensity = 3;
		const light = new THREE.DirectionalLight( color, intensity );
		light.position.set( - 1, 2, 4 );
		scene.add( light );
	}

	// generate heightmap data and store which voxels should exist in cell array. 
	const cell = new Uint8Array( cellSize * cellSize * cellSize );
	for ( let y = 0; y < cellSize; ++y) {
		for ( let z = 0; z < cellSize; ++z) {
			for ( let x = 0; x < cellSize; ++x) {
				const height = (Math.sin(x / cellSize * Math.PI * 2) + Math.sin(z / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
				if (y < height) {
					world.setVoxel(x, y, z, 1);
				}
			}
		}
	}

	const {positions, normals, indices} = world.generateGeometryDataForCell(0, 0, 0);
	const geometry = new THREE.BufferGeometry();
	const material = new THREE.MeshLambertMaterial({color:'green'});

	// form the mesh with the positions, normals, and indices information
	// for the entire cell/chunk
	const positionNumComponents = 3;
	const normalNumComponents = 3;
	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents));
	geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents));
	geometry.setIndex(indices);
	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	function resizeRendererToDisplaySize(renderer) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {
			renderer.setSize( width, height, false );
		}
		return needResize;
	}

	let renderRequested = false;

	function render() {
		renderRequested = undefined;
		if ( resizeRendererToDisplaySize( renderer ) ) {
			const canvas = renderer.domElement;
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
		}
		controls.update();
		renderer.render( scene, camera );
	}

	render();

	function requestRenderIfNotRequested() {
		if (!renderRequested) {
			renderRequested = true;
			requestAnimationFrame(render);
		}
	}

	controls.addEventListener('change', requestRenderIfNotRequested);
	window.addEventListener('resize', requestRenderIfNotRequested);
}

main();