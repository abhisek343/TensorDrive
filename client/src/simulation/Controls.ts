export class Controls {
    forward: boolean = false;
    left: boolean = false;
    right: boolean = false;
    reverse: boolean = false;
  
    constructor(type: string) {
      switch (type) {
        case 'KEYS':
          this.#addKeyboardListeners();
          break;
        case 'DUMMY':
          this.forward = true;
          break;
      }
    }
  
    #addKeyboardListeners(): void {
      document.onkeydown = (event: KeyboardEvent): void => {
        switch (event.key) {
          case 'ArrowLeft':
            this.left = true;
            break;
          case 'ArrowRight':
            this.right = true;
            break;
          case 'ArrowUp':
            this.forward = true;
            break;
          case 'ArrowDown':
            this.reverse = true;
            break;
        }
      };
  
      document.onkeyup = (event: KeyboardEvent): void => {
        switch (event.key) {
          case 'ArrowLeft':
            this.left = false;
            break;
          case 'ArrowRight':
            this.right = false;
            break;
          case 'ArrowUp':
            this.forward = false;
            break;
          case 'ArrowDown':
            this.reverse = false;
            break;
        }
      };
    }
  }
  