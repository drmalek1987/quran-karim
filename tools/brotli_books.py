"""build.sh helper: books/**/*.js -> *.js.br (Brotli q11), about 14% smaller than the APK's own deflate.
MainActivity serves books/x.js from books/x.js.br, decoded with org.brotli.dec (android/libs)."""
import brotli, os, sys
from concurrent.futures import ProcessPoolExecutor
def one(p):
    with open(p, 'rb') as f: data = f.read()
    with open(p + '.br', 'wb') as f: f.write(brotli.compress(data, quality=11, lgwin=22))
    os.remove(p)
if __name__ == '__main__':
    files = [os.path.join(d, n) for d, _, ns in os.walk(sys.argv[1]) for n in ns if n.endswith('.js')]
    with ProcessPoolExecutor() as ex: list(ex.map(one, files, chunksize=32))
    print(len(files), 'book files compressed')
