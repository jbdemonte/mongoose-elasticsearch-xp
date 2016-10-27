Steps to build a docker machine based on elasticsearch with scripting inline activated


cat elasticsearch.yml

    script.inline: true
    script.indexed: true
    network.host: 0.0.0.0


cat Dockerfile

    from elasticsearch
    copy elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml


Build the image 

    docker build -t elasticsearch-script .
    [...]
    Successfully built 8faedfb9d4f8  <= get the tag


Run it

    docker run -p 9200:9200 8faedfb9d4f8
