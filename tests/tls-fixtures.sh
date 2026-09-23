#!/bin/sh
set -eu
directory=${1:?fresh fixture directory required}
mkdir "$directory"
chmod 700 "$directory"
cd "$directory"
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 2 -subj /CN=Kutt-Disposable-Test-CA >/dev/null 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -keyout unknown-ca.key -out unknown-ca.crt -days 2 -subj /CN=Kutt-Other-Test-CA >/dev/null 2>&1
for name in server wrong expired client; do
  cn=localhost
  [ "$name" != client ] || cn=kutt
  [ "$name" != wrong ] || cn=wrong.invalid
  openssl req -newkey rsa:2048 -nodes -keyout "$name.key" -out "$name.csr" -subj "/CN=$cn" >/dev/null 2>&1
  if [ "$name" = client ]; then
    printf '%s\n' 'basicConstraints=CA:FALSE' 'keyUsage=digitalSignature,keyEncipherment' 'extendedKeyUsage=clientAuth' > extensions
  else
    sans="DNS:$cn,IP:127.0.0.1,IP:::1"
    [ "$name" != wrong ] || sans='DNS:wrong.invalid,IP:192.0.2.1,IP:2001:db8::1'
    printf '%s\n' 'basicConstraints=CA:FALSE' 'keyUsage=digitalSignature,keyEncipherment' 'extendedKeyUsage=serverAuth' "subjectAltName=$sans" > extensions
  fi
  if [ "$name" = expired ]; then
    touch index
    printf '01\n' > serial
    mkdir issued
    printf '%s\n' '[ca]' 'default_ca=test' '[test]' 'database=index' 'serial=serial' 'new_certs_dir=issued' 'certificate=ca.crt' 'private_key=ca.key' 'default_md=sha256' 'policy=policy' '[policy]' 'commonName=supplied' > ca.conf
    openssl ca -batch -notext -config ca.conf -in expired.csr -out expired.crt -extfile extensions -startdate 20000101000000Z -enddate 20000102000000Z >/dev/null 2>&1
  else
    openssl x509 -req -in "$name.csr" -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile extensions -out "$name.crt" >/dev/null 2>&1
  fi
done
chmod 600 *.key
