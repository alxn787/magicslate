export function InitDraw ( canvas:HTMLCanvasElement) {

    const ctx = canvas.getContext("2d");
            if(!ctx) return;

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    ctx.fillStyle = "rgba(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    let clicked = false;
    let startX = 0;
    let startY = 0;
    canvas.addEventListener("mousedown", (e) => {
        clicked = true;
        console.log(e.clientX,e.clientY);
        startX = e.clientX;
        startY = e.clientY;
    });
    canvas.addEventListener("mouseup", (e) => {
        clicked = false;
        console.log(e.clientX,e.clientY);
    });
    canvas.addEventListener("mousemove", (e) => {
        if(!clicked) return;
        console.log(e.clientX,e.clientY);
        const width =  e.clientX - startX;
        const height = e.clientY - startY;
       
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(255,0,255)";        
        ctx.strokeRect(startX, startY, width, height);
    });
    
}