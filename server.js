const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ulan_db'
};

let db;

app.use(cors());
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'clave-local-para-desarrollo',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 2 * 60 * 60 * 1000
    }
}));

function requiereAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ error: 'Iniciá sesión como administrador.' });
    }
    next();
}

// La vista del panel solo se sirve con sesión iniciada.
app.get('/admin.html', (req, res, next) => {
    if (!req.session.adminId) {
        return res.redirect('/login.html');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Iniciar sesión.
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body || {};

    if (
        typeof usuario !== 'string' || !usuario.trim() ||
        typeof password !== 'string' || !password
    ) {
        return res.status(400).json({ error: 'Ingresá usuario y contraseña.' });
    }

    const usuarioIngresado = usuario.trim().slice(0, 50);
    const ip = req.ip?.replace('::ffff:', '') || null;

    try {
        const [administradores] = await db.execute(
            `SELECT id
             FROM administradores
             WHERE usuario = ? AND password = ?
             LIMIT 1`,
            [usuarioIngresado, password]
        );

        const admin = administradores[0] || null;

        await db.execute(
            `INSERT INTO historial_accesos
                (admin_id, usuario_intentado, ip, exitoso)
             VALUES (?, ?, ?, ?)`,
            [admin?.id || null, usuarioIngresado, ip, admin ? 1 : 0]
        );

        if (!admin) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        req.session.adminId = admin.id;
        res.json({ exito: true });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

// Cerrar sesión.
app.post('/api/logout', requiereAdmin, (req, res) => {
    req.session.destroy(error => {
        if (error) {
            console.error('Error al cerrar sesión:', error);
            return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
        }

        res.clearCookie('connect.sid');
        res.json({ exito: true });
    });
});

// Listar servicios para el sitio público.
app.get('/api/servicios', async (req, res) => {
    try {
        const [servicios] = await db.execute(
            `SELECT id, titulo, descripcion, precio, icono
             FROM servicios
             ORDER BY id`
        );
        res.json(servicios);
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        res.status(500).json({ error: 'No se pudieron cargar los servicios.' });
    }
});

// Guardar una consulta pública.
app.post('/api/consultas', async (req, res) => {
    const { nombre, email, telefono, asunto, mensaje } = req.body || {};

    if (
        typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100 ||
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 255 ||
        typeof asunto !== 'string' || !asunto.trim() || asunto.trim().length > 150 ||
        typeof mensaje !== 'string' ||
        mensaje.trim().length < 10 || mensaje.trim().length > 5000 ||
        (telefono != null &&
            (typeof telefono !== 'string' || telefono.trim().length > 30))
    ) {
        return res.status(400).json({
            error: 'Revisá los campos. El mensaje debe tener entre 10 y 5000 caracteres.'
        });
    }

    try {
        const [resultado] = await db.execute(
            `INSERT INTO consultas (nombre, email, telefono, asunto, mensaje)
             VALUES (?, ?, ?, ?, ?)`,
            [
                nombre.trim(),
                email.trim(),
                telefono?.trim() || null,
                asunto.trim(),
                mensaje.trim()
            ]
        );

        res.status(201).json({
            mensaje: 'Consulta guardada correctamente.',
            id: resultado.insertId
        });
    } catch (error) {
        console.error('Error al guardar la consulta:', error);
        res.status(500).json({ error: 'No se pudo guardar la consulta.' });
    }
});

// Listar consultas con filtros opcionales.
app.get('/api/consultas', requiereAdmin, async (req, res) => {
    const { estado, fecha, buscar } = req.query;
    const condiciones = [];
    const valores = [];

    if (estado) {
        if (!['leida', 'no leida'].includes(estado)) {
            return res.status(400).json({ error: 'Filtro de estado inválido.' });
        }
        condiciones.push('estado = ?');
        valores.push(estado);
    }

    if (fecha) {
        if (
            typeof fecha !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ) {
            return res.status(400).json({ error: 'La fecha debe tener formato AAAA-MM-DD.' });
        }
        condiciones.push('DATE(fecha) = ?');
        valores.push(fecha);
    }

    if (typeof buscar === 'string' && buscar.trim()) {
        condiciones.push('(nombre LIKE ? OR email LIKE ?)');
        const termino = `%${buscar.trim().slice(0, 100)}%`;
        valores.push(termino, termino);
    }

    const where = condiciones.length
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    try {
        const [consultas] = await db.execute(
            `SELECT id, nombre, email, asunto, fecha, estado
             FROM consultas
             ${where}
             ORDER BY fecha DESC`,
            valores
        );
        res.json(consultas);
    } catch (error) {
        console.error('Error al obtener consultas:', error);
        res.status(500).json({ error: 'No se pudieron cargar las consultas.' });
    }
});

// Detalle de una consulta.
app.get('/api/consultas/:id', requiereAdmin, async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'ID de consulta inválido.' });
    }

    try {
        const [consultas] = await db.execute(
            `SELECT id, nombre, email, telefono, asunto, mensaje, fecha, estado
             FROM consultas
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (consultas.length === 0) {
            return res.status(404).json({ error: 'No se encontró esa consulta.' });
        }

        res.json(consultas[0]);
    } catch (error) {
        console.error('Error al obtener el detalle:', error);
        res.status(500).json({ error: 'No se pudo cargar la consulta.' });
    }
});

// Marcar una consulta como leída o no leída.
app.patch('/api/consultas/:id/estado', requiereAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { estado } = req.body || {};

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'ID de consulta inválido.' });
    }

    if (!['leida', 'no leida'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido.' });
    }

    try {
        const [resultado] = await db.execute(
            'UPDATE consultas SET estado = ? WHERE id = ?',
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'No se encontró esa consulta.' });
        }

        res.json({ exito: true });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ error: 'No se pudo actualizar el estado.' });
    }
});

async function iniciarServidor() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Conexión a MySQL establecida.');

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('No se pudo conectar a MySQL:', error);
        process.exit(1);
    }
}

iniciarServidor();