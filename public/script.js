// Canvas de partículas.
const canvas = document.getElementById('tech-canvas');
const ctx = canvas?.getContext('2d');
let particlesArray = [];

function resizeCanvas() {
    if (!canvas || !ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
}

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
    }

    draw() {
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    if (!canvas || !ctx) return;
    const cantidad = Math.floor((canvas.width * canvas.height) / 15000);
    particlesArray = Array.from({ length: cantidad }, () => new Particle());
}

function animateParticles() {
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const particle of particlesArray) {
        particle.update();
        particle.draw();
    }

    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) {
            const dx = particlesArray[a].x - particlesArray[b].x;
            const dy = particlesArray[a].y - particlesArray[b].y;
            const distancia = Math.hypot(dx, dy);

            if (distancia < 120) {
                ctx.strokeStyle = `rgba(6, 182, 212, ${(1 - distancia / 120) * 0.25})`;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animateParticles);
}

if (canvas && ctx) {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animateParticles();
}

// Animaciones.
if (window.anime) {
    anime({
        targets: '.blur-fade',
        translateY: [30, 0],
        opacity: [0, 1],
        filter: ['blur(8px)', 'blur(0px)'],
        delay: anime.stagger(180),
        easing: 'easeOutExpo',
        duration: 1200
    });

    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            anime({
                targets: entry.target,
                translateY: [35, 0],
                opacity: [0, 1],
                filter: ['blur(6px)', 'blur(0px)'],
                easing: 'easeOutExpo',
                duration: 900
            });

            currentObserver.unobserve(entry.target);
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal-card').forEach(element => {
        element.style.opacity = 0;
        element.style.filter = 'blur(6px)';
        observer.observe(element);
    });

    if (document.getElementById('wa-btn')) {
        anime({
            targets: '#wa-btn',
            scale: [1, 1.08, 1],
            loop: true,
            easing: 'easeInOutSine',
            duration: 1500
        });
    }
}

// Navegación activa.
window.addEventListener('scroll', () => {
    const secciones = document.querySelectorAll('section[id]');
    const enlaces = document.querySelectorAll('.nav-links a');
    let seccionActual = '';

    secciones.forEach(seccion => {
        if (window.scrollY >= seccion.offsetTop - 150) {
            seccionActual = seccion.id;
        }
    });

    enlaces.forEach(enlace => {
        enlace.classList.toggle(
            'active',
            enlace.getAttribute('href') === `#${seccionActual}`
        );
    });
});

// Cargar servicios desde MySQL mediante la API.
async function cargarServicios() {
    const contenedor = document.getElementById('lista-servicios');
    if (!contenedor) return;

    try {
        const respuesta = await fetch('/api/servicios');
        const servicios = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(servicios.error || 'No se pudieron cargar los servicios.');
        }

        contenedor.replaceChildren();

        servicios.forEach(servicio => {
            const tarjeta = document.createElement('article');
            tarjeta.className = 'service-card reveal-card glow-card';

            const icono = document.createElement('i');
            icono.className = servicio.icono || 'fa-solid fa-screwdriver-wrench';
            icono.setAttribute('aria-hidden', 'true');
            icono.style.color = 'var(--accent)';
            icono.style.fontSize = '1.8rem';
            icono.style.marginBottom = '1rem';

            const titulo = document.createElement('h3');
            titulo.textContent = servicio.titulo;

            const descripcion = document.createElement('p');
            descripcion.textContent = servicio.descripcion;

            const precio = document.createElement('p');
            precio.textContent = servicio.precio || 'Consultar';
            precio.style.marginTop = '1rem';
            precio.style.color = 'var(--accent)';
            precio.style.fontWeight = '700';

            tarjeta.append(icono, titulo, descripcion, precio);
            contenedor.appendChild(tarjeta);
        });

        if (servicios.length === 0) {
            contenedor.textContent = 'No hay servicios cargados todavía.';
        }
    } catch (error) {
        console.error('Error al cargar servicios:', error);
        contenedor.textContent = error.message;
    }
}

cargarServicios();

// Enviar formulario de consultas.
const formularioContacto = document.getElementById('contactForm');

if (formularioContacto) {
    formularioContacto.addEventListener('submit', async event => {
        event.preventDefault();

        if (!formularioContacto.reportValidity()) return;

        const mensajeRespuesta = document.getElementById('respuesta-formulario');
        const boton = formularioContacto.querySelector('button[type="submit"]');

        const datosConsulta = {
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            asunto: document.getElementById('asunto').value,
            mensaje: document.getElementById('mensaje').value.trim()
        };

        if (datosConsulta.mensaje.length < 10) {
            mensajeRespuesta.textContent = 'El mensaje debe tener al menos 10 caracteres.';
            return;
        }

        boton.disabled = true;
        mensajeRespuesta.textContent = 'Enviando consulta...';

        try {
            const respuesta = await fetch('/api/consultas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosConsulta)
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || 'No se pudo enviar la consulta.');
            }

            mensajeRespuesta.textContent = '¡Consulta enviada correctamente!';
            formularioContacto.reset();
        } catch (error) {
            console.error('Error al enviar consulta:', error);
            mensajeRespuesta.textContent = error.message || 'No se pudo conectar con el servidor.';
        } finally {
            boton.disabled = false;
        }
    });
}

// Efecto tilt de las tarjetas.
document.querySelectorAll('.glow-card').forEach(card => {
    card.addEventListener('mousemove', event => {
        const rect = card.getBoundingClientRect();
        const centroX = rect.width / 2;
        const centroY = rect.height / 2;
        const rotacionX = -((event.clientY - rect.top - centroY) / centroY) * 10;
        const rotacionY = ((event.clientX - rect.left - centroX) / centroX) * 10;

        card.style.transform =
            `perspective(1000px) rotateX(${rotacionX}deg) rotateY(${rotacionY}deg) translateY(-5px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// Modo claro/oscuro.
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    themeIcon?.classList.replace('fa-moon', 'fa-sun');
}

themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');

    const modoClaro = document.body.classList.contains('light-mode');
    themeIcon?.classList.toggle('fa-sun', modoClaro);
    themeIcon?.classList.toggle('fa-moon', !modoClaro);
    localStorage.setItem('theme', modoClaro ? 'light' : 'dark');
});
